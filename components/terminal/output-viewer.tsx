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
  const hasConnectedRef = useRef(false)
  const connectionAttemptsRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

  // Setup SSE connection
  useEffect(() => {
    const completeStatuses = ["success", "failed", "canceled"]
    const shouldConnect = !completeStatuses.includes(status) && !hasConnectedRef.current
    
    console.log(`[Terminal] useEffect - status=${status}, shouldConnect=${shouldConnect}, executionId=${executionId}`)
    
    if (!shouldConnect) return

    connectionAttemptsRef.current++
    hasConnectedRef.current = true

    console.log(`[Terminal] Creating SSE connection for execution ${executionId} (attempt ${connectionAttemptsRef.current})...`)
    const eventSource = new EventSource(`/api/executions/${executionId}/stream`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log(`[Terminal] SSE connected for execution ${executionId}`)
      setIsConnected(true)
    }

    eventSource.onerror = (error) => {
      console.error(`[Terminal] SSE connection error:`, error)
      setIsConnected(false)
      if (eventSourceRef.current === eventSource) {
        eventSource.close()
        eventSourceRef.current = null
        hasConnectedRef.current = false // Allow reconnection
      }
    }

    eventSource.addEventListener("connected", (event: MessageEvent) => {
      console.log("[Terminal] SSE connected event:", event.data)
    })

    eventSource.addEventListener("heartbeat", () => {
      // Heartbeat received, connection alive
    })

    eventSource.addEventListener("output", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Received output: ${data.output?.length || 0} chars`)
        if (data.output) {
          setOutput((prev) => {
            const newOutput = prev + data.output
            console.log(`[Terminal] Output updated: ${prev.length} -> ${newOutput.length} chars`)
            return newOutput
          })
        }
      } catch (err) {
        console.error("[Terminal] Error parsing output event:", err)
      }
    })

    eventSource.addEventListener("status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Status event:`, data.status)
        if (data.status && data.status !== status) {
          setStatus(data.status)
          onStatusChange?.(data.status)
        }
      } catch (err) {
        console.error("[Terminal] Error parsing status event:", err)
      }
    })

    eventSource.addEventListener("complete", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Complete event: status=${data.status}`)
        setStatus(data.status)
        setIsConnected(false)
        onStatusChange?.(data.status)
        onComplete?.()
        eventSource.close()
        eventSourceRef.current = null
      } catch (err) {
        console.error("[Terminal] Error parsing complete event:", err)
      }
    })

    eventSource.addEventListener("error", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.error(`[Terminal] Execution error event:`, data.error)
        setStatus("failed")
        setIsConnected(false)
        onStatusChange?.("failed")
        onComplete?.()
        eventSource.close()
        eventSourceRef.current = null
      } catch (err) {
        console.error("[Terminal] Error parsing error event:", err)
      }
    })

    return () => {
      console.log(`[Terminal] Cleanup for execution ${executionId}`)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      hasConnectedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]) // Only reconnect if executionId changes

  // Polling fallback
  const [pollPosition, setPollPosition] = useState(0)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunning = status === "running" || status === "pending"

  useEffect(() => {
    if (!isRunning || isConnected) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Delay polling to give SSE time
    const timeoutId = setTimeout(() => {
      if (isConnected) return
      
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
      }, 2000)
    }, 3000)

    return () => {
      clearTimeout(timeoutId)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [executionId, isRunning, isConnected, pollPosition, onStatusChange])

  // Auto-scroll
  useEffect(() => {
    scrollToBottom()
  }, [output, scrollToBottom])

  const showConnectionStatus = isRunning || isConnected

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden bg-[#0a0b0d] border border-gray-800", className)}>
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1d21] border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">opencode</span>
        
        <div className="flex items-center gap-2 ml-auto">
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
