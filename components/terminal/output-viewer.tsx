"use client"

import * as React from "react"
import { useRef, useCallback, useEffect, useState } from "react"
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
  const [isConnected, setIsConnected] = React.useState(false)
  const terminalRef = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

    // Track if we've already connected to avoid reconnection on status changes
  const hasConnectedRef = useRef(false)
  const connectionAttemptsRef = useRef(0)

  // Setup SSE connection - only runs once when component mounts
  useEffect(() => {
    // Connect for running/pending executions, skip for completed ones
    const completeStatuses = ["success", "failed", "canceled"]
    const shouldConnect = !completeStatuses.includes(initialStatus) && !hasConnectedRef.current
    
    console.log(`[Terminal] useEffect check - initialStatus=${initialStatus}, shouldConnect=${shouldConnect}, hasConnected=${hasConnectedRef.current}, executionId=${executionId}`)
    
    if (!shouldConnect) {
      if (completeStatuses.includes(initialStatus)) {
        console.log(`[Terminal] Execution already complete (${initialStatus}), not connecting SSE`)
      } else {
        console.log(`[Terminal] Already connected, skipping`)
      }
      return
    }

    connectionAttemptsRef.current++
    hasConnectedRef.current = true

    // Create new SSE connection
    console.log(`[Terminal] Connecting to SSE for execution ${executionId} (attempt ${connectionAttemptsRef.current})...`)
    const eventSource = new EventSource(`/api/executions/${executionId}/stream`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log(`[Terminal] SSE connected for execution ${executionId}`)
      setIsConnected(true)
    }

    eventSource.onerror = (error) => {
      console.error(`[Terminal] SSE connection error for execution ${executionId}:`, error)
      setIsConnected(false)
      // Close and let polling take over if SSE fails
      if (eventSourceRef.current === eventSource) {
        eventSource.close()
        eventSourceRef.current = null
      }
    }

    // Handle connected event
    eventSource.addEventListener("connected", (event: MessageEvent) => {
      console.log("[Terminal] SSE connected event:", event.data)
    })

    // Handle heartbeat to keep connection alive
    eventSource.addEventListener("heartbeat", () => {
      // Heartbeat received, connection is alive
    })

    // Handle output events
    eventSource.addEventListener("output", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      console.log(`[Terminal] Received output event:`, data)
      if (data.output) {
        console.log(`[Terminal] Adding ${data.output.length} chars to output (current length: ${output.length})`)
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
      console.log(`[Terminal] Execution complete with status: ${data.status}`)
      setStatus(data.status)
      setIsConnected(false)
      onStatusChange?.(data.status)
      onComplete?.()
      eventSource.close()
      eventSourceRef.current = null
    })

    // Handle errors
    eventSource.addEventListener("error", (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      console.error(`[Terminal] Execution error:`, data.error)
      setStatus("failed")
      setIsConnected(false)
      onStatusChange?.("failed")
      onComplete?.()
      eventSource.close()
      eventSourceRef.current = null
    })

    // Cleanup on unmount only
    return () => {
      console.log(`[Terminal] Component unmounting for execution ${executionId}`)
      if (eventSourceRef.current) {
        console.log(`[Terminal] Closing SSE connection`)
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      // Reset connection flag so we can reconnect if component remounts
      hasConnectedRef.current = false
      console.log(`[Terminal] Reset hasConnectedRef to false`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]) // Only reconnect if executionId changes

  // Polling fallback for when SSE fails or isn't available
  const [pollPosition, setPollPosition] = useState(0)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunning = status === "running" || status === "pending"

  // Polling fallback with delay to let SSE connect first
  useEffect(() => {
    // Only poll if execution is running and SSE is not connected
    if (!isRunning || isConnected) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Delay polling start to give SSE time to connect first (3 seconds)
    console.log(`[Terminal] Will start polling in 3s if SSE doesn't connect...`)
    const timeoutId = setTimeout(() => {
      // Double-check SSE still hasn't connected
      if (isConnected) {
        console.log(`[Terminal] SSE connected, skipping polling`)
        return
      }
      
      console.log(`[Terminal] Starting polling fallback for execution ${executionId}`)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const result = await pollExecutionOutput(executionId, pollPosition)
          if (result.output) {
            console.log(`[Terminal] Polled ${result.output.length} chars`)
            setOutput((prev) => prev + result.output)
            setPollPosition(result.position)
          }
          if (result.isComplete) {
            setStatus(result.status)
            onStatusChange?.(result.status)
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
          }
        } catch (error) {
          console.error(`[Terminal] Polling error:`, error)
        }
      }, 1000) // Poll every second
    }, 3000)

    return () => {
      clearTimeout(timeoutId)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [executionId, isRunning, isConnected, pollPosition, onStatusChange])

  // Auto-scroll when output changes
  useEffect(() => {
    scrollToBottom()
  }, [output, scrollToBottom])

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
                {isConnected ? "Live" : pollIntervalRef.current ? "Polling" : "Connecting..."}
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
        {output ? (
          output
        ) : isRunning ? (
          <span className="text-gray-500">Waiting for output...</span>
        ) : (
          <span className="text-gray-500">No output available</span>
        )}
        {isRunning && output && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </pre>
    </div>
  )
}
