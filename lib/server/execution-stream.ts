import { runningExecutions } from "./cli-executor"

export interface StreamEvent {
  type: "output" | "status" | "complete" | "error"
  payload: {
    output?: string
    status?: string
    exitCode?: number
    error?: string
    timestamp: string
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
  console.log(`[SSE] New subscriber for execution ${executionId}`)
  
  // Create subscriber set if not exists
  if (!subscribers.has(executionId)) {
    subscribers.set(executionId, new Set())
  }

  const executionSubscribers = subscribers.get(executionId)!
  executionSubscribers.add(callback)
  console.log(`[SSE] Subscriber added, total: ${executionSubscribers.size}`)

  // IMMEDIATELY flush any buffered output to this new subscriber
  const buffered = outputBuffers.get(executionId)
  if (buffered && buffered.length > 0) {
    const output = buffered.join("")
    console.log(`[SSE] Flushing ${output.length} chars of buffered output to new subscriber`)
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
    console.log(`[SSE] Buffer cleared for execution ${executionId}`)
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
    console.log(`[SSE] Unsubscribing from execution ${executionId}`)
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
    console.log(`[SSE] No subscribers for execution ${executionId}, buffering output`)
    return
  }

  console.log(`[SSE] Publishing ${event.type} to ${executionSubscribers.size} subscribers`)
  
  executionSubscribers.forEach((callback) => {
    try {
      callback(event)
    } catch (error) {
      console.error(`[SSE] Error publishing to subscriber:`, error)
    }
  })
}

export function publishOutput(executionId: number, output: string): void {
  console.log(`[SSE] publishOutput called: executionId=${executionId}, length=${output.length}`)
  
  const subscriberCount = getSubscriberCount(executionId)
  
  // Only buffer if no subscribers - otherwise send directly
  if (subscriberCount === 0) {
    console.log(`[SSE] Buffering output (no subscribers yet)`)
    if (!outputBuffers.has(executionId)) {
      outputBuffers.set(executionId, [])
    }
    outputBuffers.get(executionId)!.push(output)
    return
  }
  
  // We have subscribers, publish immediately
  console.log(`[SSE] Publishing to ${subscriberCount} subscribers immediately`)
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

export function getSubscriberCount(executionId: number): number {
  return subscribers.get(executionId)?.size || 0
}
