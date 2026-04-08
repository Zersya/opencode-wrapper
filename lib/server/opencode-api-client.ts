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
  type: "session.created" | "message.created" | "message.updated" | "stream.chunk" | "error"
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

  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl()
      const response = await fetch(`${baseUrl}/global/health`)
      return response.ok
    } catch {
      return false
    }
  }

  async listSessions(): Promise<OpenCodeSession[]> {
    const baseUrl = await this.getBaseUrl()
    const response = await fetch(`${baseUrl}/session`)
    
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`)
    }

    const sessions = await response.json()
    return sessions || []
  }

  async createSession(title: string = "Execution Session"): Promise<OpenCodeSession> {
    const baseUrl = await this.getBaseUrl()
    
    const response = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create session: ${response.statusText} - ${error}`)
    }

    const session = await response.json()
    console.log(`[opencode-api] Created session: ${session.id}`)
    return session
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

    const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send message: ${response.statusText} - ${error}`)
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

    const response = await fetch(`${baseUrl}/event`, {
      headers: {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
      },
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

    const processEvents = async () => {
      try {
        while (!isClosed) {
          const { done, value } = await reader.read()
          
          if (done) {
            console.log(`[opencode-api] SSE stream closed`)
            break
          }

          buffer += decoder.decode(value, { stream: true })
          
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          let currentEvent: { type: string; data: string } = { type: "", data: "" }

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent.type = line.substring(7)
            } else if (line.startsWith("data: ")) {
              currentEvent.data = line.substring(6)
            } else if (line === "" && currentEvent.type && currentEvent.data) {
              try {
                const eventData = JSON.parse(currentEvent.data)
                console.log(`[opencode-api] Received event: ${currentEvent.type}`)
                onEvent({
                  type: currentEvent.type as any,
                  data: eventData,
                })
              } catch (error) {
                console.error(`[opencode-api] Failed to parse event:`, error)
              }
              currentEvent = { type: "", data: "" }
            }
          }
        }
      } catch (error) {
        if (!isClosed) {
          console.error(`[opencode-api] SSE error:`, error)
          onError?.(error as Error)
        }
      }
    }

    processEvents()

    return () => {
      console.log(`[opencode-api] Unsubscribing from SSE events`)
      isClosed = true
      reader.cancel()
    }
  }

  async getSession(sessionId: string): Promise<OpenCodeSession> {
    const baseUrl = await this.getBaseUrl()
    const response = await fetch(`${baseUrl}/session/${sessionId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteSession(sessionId: string): Promise<void> {
    const baseUrl = await this.getBaseUrl()
    const response = await fetch(`${baseUrl}/session/${sessionId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`)
    }

    console.log(`[opencode-api] Deleted session: ${sessionId}`)
  }
}

export function createOpenCodeClient(serverType: ServerType = "global"): OpenCodeAPIClient {
  return new OpenCodeAPIClient(serverType)
}
