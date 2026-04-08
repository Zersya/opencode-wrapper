import { ensureServerRunning, getServer, type ServerType } from "./opencode-server-manager"

export interface OpenCodeSession {
  id: string
  title: string
  createdAt: string
}

export interface OpenCodeMessage {
  id: string
  role: "user" | "assistant"
  parts: Array<{
    type: "text"
    text: string
  }>
  model?: {
    providerID: string
    modelID: string
  }
  createdAt: string
}

export interface OpenCodeEvent {
  type: "session.created" | "message.created" | "message.updated" | "message.part.updated" | "stream.chunk" | "error" | "session.updated" | "session.status"
  data: any
}

export class OpenCodeAPIClient {
  private serverType: ServerType
  private baseUrl: string = ""

  constructor(serverType: ServerType = "global") {
    this.serverType = serverType
  }

  private async getBaseUrl(): Promise<string> {
    if (!this.baseUrl) {
      const { url } = await ensureServerRunning(this.serverType)
      this.baseUrl = url
    }
    return this.baseUrl
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      baseDelay?: number
      maxDelay?: number
      operationName: string
    }
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, operationName } = options
    
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes("404") || lastError.message.includes("400")) {
          throw lastError
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
          console.log(`[opencode-api] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries + 1} attempts`)
  }

  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl()
      const response = await fetch(`${baseUrl}/global/health`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      // Reset baseUrl on health check failure to force reconnection
      this.baseUrl = ""
      return false
    }
  }

  async listSessions(): Promise<OpenCodeSession[]> {
    return this.withRetry(async () => {
      const baseUrl = await this.getBaseUrl()
      const response = await fetch(`${baseUrl}/session`, {
        signal: AbortSignal.timeout(10000),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`)
      }

      const sessions = await response.json()
      return sessions || []
    }, { operationName: "listSessions", maxRetries: 2 })
  }

  async createSession(title: string = "Execution Session"): Promise<OpenCodeSession> {
    return this.withRetry(async () => {
      const baseUrl = await this.getBaseUrl()
      
      const response = await fetch(`${baseUrl}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create session: ${response.statusText} - ${error}`)
      }

      const session = await response.json()
      console.log(`[opencode-api] Created session: ${session.id}`)
      return session
    }, { operationName: "createSession", maxRetries: 3 })
  }

  async sendMessage(
    sessionId: string,
    message: string,
    options?: {
      model?: { providerID: string; modelID: string }
      agent?: string
    }
  ): Promise<OpenCodeMessage> {
    const baseUrl = await this.getBaseUrl()
    
    const payload = {
      parts: [{ type: "text", text: message }],
      model: options?.model,
      agent: options?.agent,
    }

    console.log(`[opencode-api] Sending message to session ${sessionId}: "${message.substring(0, 100)}..."`)

    // No retry for sendMessage - if session is gone, it's gone
    const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000), // 60 second timeout for message sending
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // Special handling for session not found - don't retry, fail immediately
      if (response.status === 404 || errorText.includes("Session not found") || errorText.includes("NotFoundError")) {
        console.error(`[opencode-api] Session ${sessionId} not found - server may have crashed and lost session data`)
        throw new Error(`Session not found: ${sessionId}. The OpenCode server may have crashed and lost session data. Please retry the execution.`)
      }
      
      throw new Error(`Failed to send message: ${response.statusText} - ${errorText}`)
    }

    const msg = await response.json()
    console.log(`[opencode-api] Message sent successfully: ${msg.id}`)
    return msg
  }

  async subscribeToEvents(
    onEvent: (event: OpenCodeEvent) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const baseUrl = await this.getBaseUrl()
    
    console.log(`[opencode-api] Subscribing to SSE events at ${baseUrl}/event`)

    try {
      const controller = new AbortController()
      
      const response = await fetch(`${baseUrl}/event`, {
        headers: {
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to subscribe to events: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error("Response body is null")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let isClosed = false
      let lastEventTime = Date.now()
      const HEARTBEAT_TIMEOUT = 60000 // 60 seconds

      let bytesReceived = 0
      let messagePartCount = 0
      let totalCharsFromParts = 0
      
      const processEvents = async () => {
        try {
          while (!isClosed) {
            const { done, value } = await reader.read()
            
            if (done) {
              console.log(`[opencode-api] SSE stream closed normally (received ${bytesReceived} bytes)`)
              break
            }

            lastEventTime = Date.now()
            if (value) {
              bytesReceived += value.length
            }
            buffer += decoder.decode(value, { stream: true })
            
            // OpenCode SSE format: each line is "data: {json}\n"
            // The event type is inside the JSON as "type" field
            const lines = buffer.split("\n")
            buffer = lines.pop() || "" // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const jsonStr = line.substring(6)
                try {
                  const eventData = JSON.parse(jsonStr)
                  // Extract event type from the JSON data itself
                  const eventType = eventData.type || "unknown"
                  
                  // Count as event received
                  lastEventTime = Date.now()
                  
                  // Track message.part.updated count for debugging
                  if (eventType === "message.part.updated") {
                    messagePartCount++
                    const text = eventData?.properties?.part?.text || ""
                    totalCharsFromParts += text.length
                    // Log every 10th message.part.updated event with stats
                    if (messagePartCount % 10 === 0 || messagePartCount === 1) {
                      console.log(`[opencode-api] message.part.updated #${messagePartCount} with ${text.length} chars (total: ${totalCharsFromParts})`)
                    }
                  } else if (!["stream.chunk", "message.part.delta", "message.updated", "session.updated", "session.status", "session.diff", "server.heartbeat"].includes(eventType)) {
                    console.log(`[opencode-api] Event: ${eventType}`)
                  }
                  
                  onEvent({
                    type: eventType as any,
                    data: eventData,
                  })
                } catch (error) {
                  console.error(`[opencode-api] Failed to parse event data:`, jsonStr.substring(0, 200))
                }
              }
            }
          }
        } catch (error) {
          if (!isClosed) {
            const timeSinceLastEvent = Date.now() - lastEventTime
            console.error(`[opencode-api] SSE error (last event ${timeSinceLastEvent}ms ago):`, error)
            onError?.(error as Error)
          }
        }
      }

      processEvents()

      // Heartbeat check with periodic stats
      let lastBytesReceived = 0
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval)
          return
        }
        
        const timeSinceLastEvent = Date.now() - lastEventTime
        const bytesThisInterval = bytesReceived - lastBytesReceived
        lastBytesReceived = bytesReceived
        
        // Log every 10 seconds if we're receiving data
        if (bytesThisInterval > 0) {
          console.log(`[opencode-api] SSE active: ${bytesReceived} total bytes, +${bytesThisInterval} bytes, ${messagePartCount} message parts (${totalCharsFromParts} chars) in last 10s`)
        } else if (timeSinceLastEvent > 30000) {
          console.log(`[opencode-api] SSE quiet: ${bytesReceived} total bytes, no data for ${(timeSinceLastEvent/1000).toFixed(1)}s`)
        }
        
        if (timeSinceLastEvent > HEARTBEAT_TIMEOUT) {
          console.error(`[opencode-api] SSE heartbeat timeout - no events for ${timeSinceLastEvent}ms, ${bytesReceived} bytes received total`)
          isClosed = true
          reader.cancel().catch(() => {})
          controller.abort()
          onError?.(new Error("SSE heartbeat timeout"))
        }
      }, 10000)

      return () => {
        console.log(`[opencode-api] Unsubscribing from SSE events`)
        isClosed = true
        clearInterval(heartbeatInterval)
        controller.abort()
        reader.cancel().catch(() => {})
      }
    } catch (error) {
      console.error(`[opencode-api] Failed to subscribe to events:`, error)
      throw error
    }
  }

  async getSession(sessionId: string): Promise<OpenCodeSession | null> {
    return this.withRetry(async () => {
      const baseUrl = await this.getBaseUrl()
      const response = await fetch(`${baseUrl}/session/${sessionId}`, {
        signal: AbortSignal.timeout(10000),
      })
      
      if (response.status === 404) {
        return null // Session not found (might have been deleted)
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`)
      }

      return response.json()
    }, { operationName: "getSession", maxRetries: 2 })
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.withRetry(async () => {
        const baseUrl = await this.getBaseUrl()
        const response = await fetch(`${baseUrl}/session/${sessionId}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          // If session is already gone (404), that's fine for cleanup
          if (response.status === 404) {
            console.log(`[opencode-api] Session ${sessionId} already deleted or not found`)
            return
          }
          throw new Error(`Failed to delete session: ${response.statusText}`)
        }

        console.log(`[opencode-api] Deleted session: ${sessionId}`)
      }, { operationName: "deleteSession", maxRetries: 2 })
    } catch (error) {
      // Don't throw on delete errors - session might already be gone
      console.warn(`[opencode-api] Failed to delete session ${sessionId}:`, error)
    }
  }
}

export function createOpenCodeClient(serverType: ServerType = "global"): OpenCodeAPIClient {
  return new OpenCodeAPIClient(serverType)
}
