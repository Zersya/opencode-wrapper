import { runningExecutions } from "./cli-executor"

export interface StreamEvent {
  type: "output" | "status" | "complete" | "error" | "question" | "progress"
  payload: {
    output?: string
    status?: string
    exitCode?: number
    error?: string
    timestamp: string
    questionType?: "input" | "choice" | "confirmation"
    phase?: string
    progressPercent?: number
    currentTool?: string
  }
}

type EventCallback = (event: StreamEvent) => void

// Buffer configuration
const MAX_BUFFER_SIZE = 50 // Max chunks before forced flush
const BUFFER_TIMEOUT_MS = 100 // Flush after 100ms of inactivity
const MAX_BUFFER_AGE_MS = 500 // Force flush after 500ms regardless

// Use globalThis to ensure Maps are shared across all module instances
declare global {
  // eslint-disable-next-line no-var
  var __sseSubscribers: Map<number, Set<EventCallback>> | undefined
  // eslint-disable-next-line no-var
  var __sseOutputBuffers: Map<number, string[]> | undefined
  // eslint-disable-next-line no-var
  var __sseBufferTimers: Map<number, NodeJS.Timeout> | undefined
  // eslint-disable-next-line no-var
  var __sseBufferStartTime: Map<number, number> | undefined
}

const subscribers: Map<number, Set<EventCallback>> = 
  globalThis.__sseSubscribers || (globalThis.__sseSubscribers = new Map())
const outputBuffers: Map<number, string[]> = 
  globalThis.__sseOutputBuffers || (globalThis.__sseOutputBuffers = new Map())
const bufferTimers: Map<number, NodeJS.Timeout> = 
  globalThis.__sseBufferTimers || (globalThis.__sseBufferTimers = new Map())
const bufferStartTime: Map<number, number> = 
  globalThis.__sseBufferStartTime || (globalThis.__sseBufferStartTime = new Map())

// Flush buffer for an execution
function flushBuffer(executionId: number): void {
  const buffer = outputBuffers.get(executionId)
  if (!buffer || buffer.length === 0) return
  
  const output = buffer.join("")
  outputBuffers.set(executionId, []) // Clear buffer
  bufferStartTime.delete(executionId)
  
  const subscriberCount = getSubscriberCount(executionId)
  if (subscriberCount > 0) {
    console.log(`[SSE] Flushing ${buffer.length} chunks (${output.length} chars) to ${subscriberCount} subscribers for ${executionId}`)
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output,
        timestamp: new Date().toISOString(),
      },
    })
  }
}

// Schedule buffer flush
function scheduleFlush(executionId: number): void {
  // Clear existing timer
  const existingTimer = bufferTimers.get(executionId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }
  
  // Set buffer start time if not set
  if (!bufferStartTime.has(executionId)) {
    bufferStartTime.set(executionId, Date.now())
  }
  
  // Schedule new flush
  const timer = setTimeout(() => {
    flushBuffer(executionId)
    bufferTimers.delete(executionId)
  }, BUFFER_TIMEOUT_MS)
  
  bufferTimers.set(executionId, timer)
}

export function subscribeToExecution(
  executionId: number,
  callback: EventCallback
): () => void {
  // Create subscriber set if not exists
  if (!subscribers.has(executionId)) {
    subscribers.set(executionId, new Set())
  }

  const executionSubscribers = subscribers.get(executionId)!
  executionSubscribers.add(callback)
  
  console.log(`[SSE] New subscriber for execution ${executionId}, total: ${executionSubscribers.size}`)

  // IMMEDIATELY flush any buffered output to this new subscriber
  flushBuffer(executionId)

  // Send current status
  const running = runningExecutions.get(executionId)
  if (running) {
    callback({
      type: "status",
      payload: {
        status: running.status,
        timestamp: new Date().toISOString(),
      },
    })
    
    // Send current progress if available
    if (running.progress) {
      callback({
        type: "progress",
        payload: {
          phase: running.progress.phase,
          progressPercent: running.progress.progressPercent,
          currentTool: running.progress.currentTool,
          timestamp: new Date().toISOString(),
        },
      })
    }
  }

  // Return unsubscribe function
  return () => {
    executionSubscribers.delete(callback)
    if (executionSubscribers.size === 0) {
      subscribers.delete(executionId)
      // Clean up any pending buffers and timers
      const timer = bufferTimers.get(executionId)
      if (timer) {
        clearTimeout(timer)
        bufferTimers.delete(executionId)
      }
    }
  }
}

export function publishToExecution(
  executionId: number,
  event: StreamEvent
): void {
  const executionSubscribers = subscribers.get(executionId)
  
  if (!executionSubscribers || executionSubscribers.size === 0) {
    return
  }
  
  executionSubscribers.forEach((callback) => {
    try {
      callback(event)
    } catch (error) {
      console.error(`[SSE] Error publishing to subscriber:`, error)
    }
  })
}

export function publishOutput(executionId: number, output: string): void {
  const subscriberCount = getSubscriberCount(executionId)
  
  // Log for debugging (only for substantial output)
  if (output.length > 100 && !output.includes("[opencode-wrapper]")) {
    console.log(`[SSE] publishOutput called for ${executionId}, ${output.length} chars, ${subscriberCount} subscribers`)
  }
  
  if (subscriberCount === 0) {
    // No subscribers - buffer for later
    if (!outputBuffers.has(executionId)) {
      outputBuffers.set(executionId, [])
    }
    const buffer = outputBuffers.get(executionId)!
    buffer.push(output)
    
    // Limit buffer size
    if (buffer.length > MAX_BUFFER_SIZE) {
      console.log(`[SSE] Buffer full for ${executionId}, flushing early`)
      flushBuffer(executionId)
    }
    return
  }
  
  // We have subscribers - use smart batching
  if (!outputBuffers.has(executionId)) {
    outputBuffers.set(executionId, [])
  }
  
  const buffer = outputBuffers.get(executionId)!
  buffer.push(output)
  
  // Check if we should flush
  const shouldFlush = 
    buffer.length >= MAX_BUFFER_SIZE || // Buffer full
    (bufferStartTime.has(executionId) && 
     Date.now() - bufferStartTime.get(executionId)! > MAX_BUFFER_AGE_MS) // Too old
  
  if (shouldFlush) {
    flushBuffer(executionId)
    // Clear any pending timer since we flushed
    const timer = bufferTimers.get(executionId)
    if (timer) {
      clearTimeout(timer)
      bufferTimers.delete(executionId)
    }
  } else {
    // Schedule a flush
    scheduleFlush(executionId)
  }
}

export function publishStatus(executionId: number, status: string): void {
  // Flush any pending output before status change
  flushBuffer(executionId)
  
  publishToExecution(executionId, {
    type: "status",
    payload: {
      status,
      timestamp: new Date().toISOString(),
    },
  })
}

export function publishComplete(
  executionId: number,
  status: string,
  exitCode?: number
): void {
  // Flush any remaining buffered output first
  flushBuffer(executionId)

  publishToExecution(executionId, {
    type: "complete",
    payload: {
      status,
      exitCode,
      timestamp: new Date().toISOString(),
    },
  })

  // Clean up after delay
  setTimeout(() => {
    subscribers.delete(executionId)
    outputBuffers.delete(executionId)
    bufferTimers.delete(executionId)
    bufferStartTime.delete(executionId)
  }, 10000)
}

export function publishError(executionId: number, error: string): void {
  // Flush any remaining buffered output first
  flushBuffer(executionId)

  publishToExecution(executionId, {
    type: "error",
    payload: {
      error,
      timestamp: new Date().toISOString(),
    },
  })

  // Clean up after delay
  setTimeout(() => {
    subscribers.delete(executionId)
    outputBuffers.delete(executionId)
    bufferTimers.delete(executionId)
    bufferStartTime.delete(executionId)
  }, 10000)
}

export function publishQuestion(
  executionId: number,
  question: string,
  questionType: "input" | "choice" | "confirmation" = "input"
): void {
  // Flush any pending output before question
  flushBuffer(executionId)
  
  publishToExecution(executionId, {
    type: "question",
    payload: {
      output: question,
      questionType,
      status: "waiting_for_input",
      timestamp: new Date().toISOString(),
    },
  })
}

export function publishProgress(
  executionId: number,
  phase: string,
  progressPercent: number,
  currentTool?: string
): void {
  publishToExecution(executionId, {
    type: "progress",
    payload: {
      phase,
      progressPercent,
      currentTool,
      timestamp: new Date().toISOString(),
    },
  })
}

export function getSubscriberCount(executionId: number): number {
  return subscribers.get(executionId)?.size || 0
}

// Cleanup function for manual cleanup
export function cleanupExecution(executionId: number): void {
  const timer = bufferTimers.get(executionId)
  if (timer) {
    clearTimeout(timer)
  }
  subscribers.delete(executionId)
  outputBuffers.delete(executionId)
  bufferTimers.delete(executionId)
  bufferStartTime.delete(executionId)
}
