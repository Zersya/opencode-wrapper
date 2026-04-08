"use client"

import * as React from "react"
import { useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface TerminalOutputViewerProps {
  executionId: number
  initialOutput?: string
  initialStatus?: string
  className?: string
  onStatusChange?: (status: string) => void
  onComplete?: () => void
}

const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  running: "text-amber-400",
  success: "text-green-400",
  failed: "text-red-400",
  canceled: "text-gray-500",
}

const statusBgColors: Record<string, string> = {
  pending: "bg-gray-400",
  running: "bg-amber-400",
  success: "bg-green-400",
  failed: "bg-red-400",
  canceled: "bg-gray-500",
}

export function TerminalOutputViewer({
  executionId,
  initialOutput = "",
  initialStatus = "pending",
  className,
  onStatusChange,
  onComplete,
}: TerminalOutputViewerProps) {
  const [output, setOutput] = React.useState(initialOutput)
  const [status, setStatus] = React.useState(initialStatus)
  const [isConnected, setIsConnected] = React.useState(false)
  const terminalRef = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

  // Setup SSE connection
  useEffect(() => {
    // Only connect if execution is not complete
    const isComplete = ["success", "failed", "canceled"].includes(status)
    if (isComplete) return

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Create new SSE connection
    const eventSource = new EventSource(`/api/executions/${executionId}/stream`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error)
      setIsConnected(false)
      // Don't immediately close - let it retry automatically
    }

    // Handle connected event
    eventSource.addEventListener("connected", (event: MessageEvent) => {
      console.log("SSE connected:", event.data)
    })

    // Handle output events
    eventSource.addEventListener("output", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.output) {
        setOutput((prev) => prev + data.output)
      }
    })

    // Handle status events
    eventSource.addEventListener("status", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.status && data.status !== status) {
        setStatus(data.status)
        onStatusChange?.(data.status)
      }
    })

    // Handle completion
    eventSource.addEventListener("complete", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      setStatus(data.status)
      setIsConnected(false)
      onStatusChange?.(data.status)
      onComplete?.()
      eventSource.close()
    })

    // Handle errors
    eventSource.addEventListener("error", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      console.error("Execution error:", data.error)
      setStatus("failed")
      setIsConnected(false)
      onStatusChange?.("failed")
      onComplete?.()
      eventSource.close()
    })

    // Cleanup on unmount or when execution completes
    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [executionId, status, onStatusChange, onComplete])

  // Auto-scroll when output changes
  useEffect(() => {
    scrollToBottom()
  }, [output, scrollToBottom])

  const isRunning = status === "running" || status === "pending"
  const showConnectionStatus = isRunning || isConnected

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden bg-[#0a0b0d] border border-gray-800", className)}>
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1d21] border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">opencode</span>
        
        <div className="flex items-center gap-2 ml-auto">
          {/* Connection indicator */}
          {showConnectionStatus && (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-400" : "bg-gray-400"
              )} />
              <span className="text-xs text-gray-500 font-mono">
                {isConnected ? "Live" : "Connecting..."}
              </span>
            </div>
          )}
          
          {/* Status badge */}
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", statusBgColors[status])} />
            <span className={cn("text-xs font-mono", statusColors[status])}>
              {isRunning && status === "running" ? "Running..." : 
               isRunning && status === "pending" ? "Pending..." :
               status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <pre
        ref={terminalRef}
        className="flex-1 overflow-auto p-4 text-sm font-mono text-gray-300 leading-relaxed min-h-[300px] max-h-[500px] whitespace-pre-wrap break-all"
      >
        {output || (
          <span className="text-gray-500">
            {isRunning ? "Waiting for output..." : "No output available"}
          </span>
        )}
        {isRunning && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </pre>
    </div>
  )
}
