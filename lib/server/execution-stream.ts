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

// Rate limiting configuration
const MAX_SUBSCRIBERS_PER_EXECUTION = 10
const OUTPUT_THROTTLE_MS = 100 // Minimum time between output publishes

// Track last publish time for each execution (for throttling)
const lastPublishTime = new Map<number, number>()
const pendingOutput = new Map<number, string>()

export function subscribeToExecution(
  executionId: number,
  callback: EventCallback
): () => void {
  // Create subscriber set if not exists
  if (!subscribers.has(executionId)) {
    subscribers.set(executionId, new Set())
  }

  const executionSubscribers = subscribers.get(executionId)!

  // Enforce subscriber limit
  if (executionSubscribers.size >= MAX_SUBSCRIBERS_PER_EXECUTION) {
    console.warn(`Max subscribers (${MAX_SUBSCRIBERS_PER_EXECUTION}) reached for execution ${executionId}`)
    // Return no-op unsubscribe
    return () => {}
  }

  executionSubscribers.add(callback)

  // Get current execution state for initial data
  const running = runningExecutions.get(executionId)
  if (running) {
    // Send any accumulated output immediately
    if (running.output.length > 0) {
      callback({
        type: "output",
        payload: {
          output: running.output.join(""),
          status: running.status,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Send current status
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
      lastPublishTime.delete(executionId)
      pendingOutput.delete(executionId)
    }
  }
}

export function publishToExecution(
  executionId: number,
  event: StreamEvent
): void {
  const executionSubscribers = subscribers.get(executionId)
  if (!executionSubscribers) return

  executionSubscribers.forEach((callback) => {
    try {
      callback(event)
    } catch (error) {
      console.error(`Error publishing to subscriber for execution ${executionId}:`, error)
    }
  })
}

export function publishOutput(executionId: number, output: string): void {
  const now = Date.now()
  const lastPublish = lastPublishTime.get(executionId) || 0
  const timeSinceLastPublish = now - lastPublish

  // Accumulate pending output
  const currentPending = pendingOutput.get(executionId) || ""
  pendingOutput.set(executionId, currentPending + output)

  // Throttle publishing to prevent overwhelming clients
  if (timeSinceLastPublish < OUTPUT_THROTTLE_MS) {
    // Schedule publish after throttle delay
    setTimeout(() => {
      const pending = pendingOutput.get(executionId)
      if (pending) {
        pendingOutput.delete(executionId)
        lastPublishTime.set(executionId, Date.now())
        publishToExecution(executionId, {
          type: "output",
          payload: {
            output: pending,
            timestamp: new Date().toISOString(),
          },
        })
      }
    }, OUTPUT_THROTTLE_MS - timeSinceLastPublish)
  } else {
    // Publish immediately
    const pending = pendingOutput.get(executionId)
    if (pending) {
      pendingOutput.delete(executionId)
      lastPublishTime.set(executionId, now)
      publishToExecution(executionId, {
        type: "output",
        payload: {
          output: pending,
          timestamp: new Date().toISOString(),
        },
      })
    }
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
  // Flush any pending output first
  const pending = pendingOutput.get(executionId)
  if (pending) {
    pendingOutput.delete(executionId)
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output: pending,
        timestamp: new Date().toISOString(),
      },
    })
  }

  publishToExecution(executionId, {
    type: "complete",
    payload: {
      status,
      exitCode,
      timestamp: new Date().toISOString(),
    },
  })

  // Clean up subscribers after a short delay
  setTimeout(() => {
    subscribers.delete(executionId)
    lastPublishTime.delete(executionId)
    pendingOutput.delete(executionId)
  }, 5000)
}

export function publishError(executionId: number, error: string): void {
  // Flush any pending output first
  const pending = pendingOutput.get(executionId)
  if (pending) {
    pendingOutput.delete(executionId)
    publishToExecution(executionId, {
      type: "output",
      payload: {
        output: pending,
        timestamp: new Date().toISOString(),
      },
    })
  }

  publishToExecution(executionId, {
    type: "error",
    payload: {
      error,
      timestamp: new Date().toISOString(),
    },
  })

  // Clean up subscribers after a short delay
  setTimeout(() => {
    subscribers.delete(executionId)
    lastPublishTime.delete(executionId)
    pendingOutput.delete(executionId)
  }, 5000)
}

export function getSubscriberCount(executionId: number): number {
  return subscribers.get(executionId)?.size || 0
}
