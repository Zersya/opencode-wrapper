import { auth } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"
import { subscribeToExecution, type StreamEvent } from "@/lib/server/execution-stream"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id: executionId } = await params
  const executionIdNum = parseInt(executionId, 10)

  if (isNaN(executionIdNum)) {
    return new Response("Invalid execution ID", { status: 400 })
  }

  console.log(`[SSE] Client connected to execution ${executionIdNum}`)

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message immediately
      const connectedMsg = `event: connected\ndata: ${JSON.stringify({ executionId: executionIdNum })}\n\n`
      controller.enqueue(encoder.encode(connectedMsg))
      console.log(`[SSE] Sent connected event for execution ${executionIdNum}`)

      // Subscribe to execution updates
      const unsubscribe = subscribeToExecution(
        executionIdNum,
        (data: StreamEvent) => {
          if (isClosed) return
          
          try {
            const message = `event: ${data.type}\ndata: ${JSON.stringify(data.payload)}\n\n`
            controller.enqueue(encoder.encode(message))
            console.log(`[SSE] Sent ${data.type} event for execution ${executionIdNum}`)

            // Close stream if execution is complete
            if (data.type === "complete" || data.type === "error") {
              console.log(`[SSE] Closing stream for completed execution ${executionIdNum}`)
              isClosed = true
              controller.close()
              unsubscribe()
            }
          } catch (error) {
            // Client disconnected
            console.log(`[SSE] Client disconnected from execution ${executionIdNum}`, error)
            isClosed = true
            unsubscribe()
          }
        }
      )

      // Send heartbeat every 15 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval)
          return
        }
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`))
        } catch {
          // Connection closed
          clearInterval(heartbeatInterval)
          isClosed = true
        }
      }, 15000)

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        console.log(`[SSE] Client aborted connection for execution ${executionIdNum}`)
        isClosed = true
        clearInterval(heartbeatInterval)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  console.log(`[SSE] Returning stream response for execution ${executionIdNum}`)
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform, must-revalidate, max-age=0",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
