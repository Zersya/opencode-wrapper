import { runningExecutions } from "./cli-executor"

export interface StreamEvent {
  type: "output" | "status" | "complete" | "error" | "question"
  payload: {
    output?: string
    status?: string
    exitCode?: number
    error?: string
    timestamp: string
    questionType?: "input" | "choice" | "confirmation"
  }
}

type EventCallback = (event: StreamEvent) => void

// Use globalThis to ensure Maps are shared across all module instances
// (prevents issues with Next.js hot-reload and ESM module duplication)
declare global {
  // eslint-disable-next-line no-var
  var __sseSubscribers: Map<number, Set<EventCallback>> | undefined
  // eslint-disable-next-line no-var
  var __sseOutputBuffers: Map<number, string[]> | undefined
}

const subscribers: Map<number, Set<EventCallback>> = 
  globalThis.__sseSubscribers || (globalThis.__sseSubscribers = new Map())
const outputBuffers: Map<number, string[]> = 
  globalThis.__sseOutputBuffers || (globalThis.__sseOutputBuffers = new Map())

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

  // IMMEDIATELY flush any buffered output to this new subscriber
  const buffered = outputBuffers.get(executionId)
  if (buffered && buffered.length > 0) {
    const output = buffered.join("")
    callback({
      type: "output",
      payload: {
        output,
        status: "running",
        timestamp: new Date().toISOString(),
      },
    })
    // Clear buffer after flushing to prevent duplicate sends
    outputBuffers.delete(executionId)
  }

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
  }

  // Return unsubscribe function
  return () => {
    executionSubscribers.delete(callback)
    if (executionSubscribers.size === 0) {
      subscribers.delete(executionId)
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
  
  // Only buffer if no subscribers - otherwise send directly
  if (subscriberCount === 0) {
    if (!outputBuffers.has(executionId)) {
      outputBuffers.set(executionId, [])
    }
    outputBuffers.get(executionId)!.push(output)
    return
  }
  
  // We have subscribers, publish immediately
  publishToExecution(executionId, {
    type: "output",
    payload: {
      output,
      timestamp: new Date().toISOString(),
    },
  })
}

export function publishStatus(executionId: number, status: string): void {
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
  // Flush any remaining buffered output
  const buffered = outputBuffers.get(executionId)
  if (buffered && buffered.length > 0) {
    const output = buffered.join("")
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output,
        timestamp: new Date().toISOString(),
      },
    })
    outputBuffers.delete(executionId)
  }

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
  }, 10000)
}

export function publishError(executionId: number, error: string): void {
  // Flush any remaining buffered output first
  const buffered = outputBuffers.get(executionId)
  if (buffered && buffered.length > 0) {
    const output = buffered.join("")
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output,
        timestamp: new Date().toISOString(),
      },
    })
    outputBuffers.delete(executionId)
  }

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
  }, 10000)
}

export function publishQuestion(
  executionId: number,
  question: string,
  questionType: "input" | "choice" | "confirmation" = "input"
): void {
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

export function getSubscriberCount(executionId: number): number {
  return subscribers.get(executionId)?.size || 0
}
