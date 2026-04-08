import { auth } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"
import { subscribeToExecution, type StreamEvent } from "@/lib/server/execution-stream"

export const dynamic = "force-dynamic"

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

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ executionId: executionIdNum })}\n\n`)
      )

      // Subscribe to execution updates
      const unsubscribe = subscribeToExecution(
        executionIdNum,
        (data: StreamEvent) => {
          try {
            const message = `event: ${data.type}\ndata: ${JSON.stringify(data.payload)}\n\n`
            controller.enqueue(encoder.encode(message))

            // Close stream if execution is complete
            if (data.type === "complete" || data.type === "error") {
              controller.close()
              unsubscribe()
            }
          } catch (error) {
            // Client disconnected
            unsubscribe()
          }
        }
      )

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
