"use client"

import * as React from "react"
import { useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { pollExecutionOutput } from "@/lib/actions/executions"

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
  const [position, setPosition] = React.useState(0)
  const terminalRef = useRef<HTMLPreElement>(null)

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (status === "running" || status === "pending") {
      const interval = setInterval(async () => {
        try {
          const result = await pollExecutionOutput(executionId, position)

          if (result.output) {
            setOutput((prev) => prev + result.output)
            setPosition(result.position)
          }

          if (result.status !== status) {
            setStatus(result.status)
            onStatusChange?.(result.status)
          }

          if (result.isComplete) {
            clearInterval(interval)
            onComplete?.()
          }
        } catch (error) {
          console.error("Failed to poll execution:", error)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [executionId, position, status, onStatusChange, onComplete])

  useEffect(() => {
    scrollToBottom()
  }, [output, scrollToBottom])

  const isRunning = status === "running" || status === "pending"

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
          {isRunning && (
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", statusBgColors[status])} />
              <span className={cn("text-xs font-mono", statusColors[status])}>
                {status === "running" ? "Running..." : "Pending..."}
              </span>
            </div>
          )}
          {!isRunning && (
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", statusBgColors[status])} />
              <span className={cn("text-xs font-mono", statusColors[status])}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <pre
        ref={terminalRef}
        className="flex-1 overflow-auto p-4 text-sm font-mono text-gray-300 leading-relaxed min-h-[300px] max-h-[500px]"
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
