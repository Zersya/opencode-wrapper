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

const subscribers = new Map<number, Set<EventCallback>>()

// Simple buffer for output when no subscribers exist yet
const outputBuffers = new Map<number, string[]>()

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
    // Don't clear buffer - other new subscribers might need it too
    // Only clear when execution completes
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
      // Keep buffer in case someone reconnects
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
  
  // Always buffer the output
  if (!outputBuffers.has(executionId)) {
    outputBuffers.set(executionId, [])
  }
  outputBuffers.get(executionId)!.push(output)
  
  // Publish immediately if we have subscribers
  const subscriberCount = getSubscriberCount(executionId)
  if (subscriberCount > 0) {
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output,
        timestamp: new Date().toISOString(),
      },
    })
  } else {
    console.log(`[SSE] Buffering output (no subscribers yet)`)
  }
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
