import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { 
  sendInputToExecution, 
  isExecutionRunning,
  isWaitingForInput,
  getQuestionPrompt
} from "@/lib/server/cli-executor"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: executionId } = await params
    const executionIdNum = parseInt(executionId, 10)

    if (isNaN(executionIdNum)) {
      return NextResponse.json({ error: "Invalid execution ID" }, { status: 400 })
    }

    const body = await request.json()
    const { input } = body

    if (!input || typeof input !== "string") {
      return NextResponse.json({ 
        error: "Input is required and must be a string" 
      }, { status: 400 })
    }

    if (!isExecutionRunning(executionIdNum)) {
      return NextResponse.json({ 
        error: "Execution is not running" 
      }, { status: 400 })
    }

    const result = await sendInputToExecution(executionIdNum, input)

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true,
      message: "Input sent successfully"
    })
  } catch (error) {
    console.error("[API] Error sending input:", error)
    return NextResponse.json({ 
      error: "Failed to send input" 
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: executionId } = await params
    const executionIdNum = parseInt(executionId, 10)

    if (isNaN(executionIdNum)) {
      return NextResponse.json({ error: "Invalid execution ID" }, { status: 400 })
    }

    const isWaiting = isWaitingForInput(executionIdNum)
    const question = getQuestionPrompt(executionIdNum)

    return NextResponse.json({
      waitingForInput: isWaiting,
      question: question || null,
    })
  } catch (error) {
    console.error("[API] Error checking input status:", error)
    return NextResponse.json({ 
      error: "Failed to check input status" 
    }, { status: 500 })
  }
}
