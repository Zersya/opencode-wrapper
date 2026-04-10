"use client"

import * as React from "react"
import { useRef, useCallback, useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { pollExecutionOutput } from "@/lib/actions/executions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ToolCallCard } from "./tool-call-card"
import { parseToolCalls, type ToolCall } from "./tool-call-parser"
import { ExecutionHeader } from "./execution-header"
import type { ExecutionProgress, ExecutionPhase, ToolExecution, FileChange } from "@/lib/terminal/progress-types"

interface TerminalOutputViewerProps {
  executionId: number
  initialOutput?: string
  initialStatus?: string
  className?: string
  onStatusChange?: (status: string) => void
  onComplete?: () => void
  repositoryInfo?: {
    name: string
    branch: string
    commit?: string
  }
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
  repositoryInfo,
}: TerminalOutputViewerProps) {
  const [output, setOutput] = React.useState(initialOutput)
  const [status, setStatus] = React.useState(initialStatus)
  const [isConnected, setIsConnected] = React.useState(false)
  const [isQuestionModalOpen, setIsQuestionModalOpen] = React.useState(false)
  const [questionPrompt, setQuestionPrompt] = React.useState("")
  const [questionType, setQuestionType] = React.useState<"input" | "choice" | "confirmation" | undefined>()
  const [answer, setAnswer] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const hasConnectedRef = useRef(false)
  const connectionAttemptsRef = useRef(0)

  // Track progress with realistic state
  const [progress, setProgress] = React.useState<ExecutionProgress>({
    phase: 'connecting',
    startTime: Date.now(),
    elapsedMs: 0,
    tools: [],
    completedTools: 0,
    totalTools: 0,
    filesChanged: [],
    waitingForQuestion: false,
  })

  // Track running tools for detecting file changes
  const runningToolsRef = useRef<Map<string, ToolExecution>>(new Map())
  const lastOutputTimeRef = useRef<number>(Date.now())

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

  // Update elapsed time every second
  useEffect(() => {
    if (status !== 'running' && status !== 'pending') return
    
    const interval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        elapsedMs: Date.now() - prev.startTime,
      }))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [status])

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
      setProgress(prev => ({ ...prev, phase: 'analyzing' }))
    }

    eventSource.onerror = (error) => {
      console.error(`[Terminal] SSE connection error:`, error)
      setIsConnected(false)
      if (eventSourceRef.current === eventSource) {
        eventSource.close()
        eventSourceRef.current = null
        hasConnectedRef.current = false
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
          
          // Track tool calls from output
          detectToolCallsFromOutput(data.output)
          
          lastOutputTimeRef.current = Date.now()
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
          
          // Update progress phase based on status
          if (data.status === 'running') {
            setProgress(prev => ({ ...prev, phase: 'executing' }))
          } else if (data.status === 'success') {
            setProgress(prev => ({ ...prev, phase: 'complete' }))
          } else if (data.status === 'failed') {
            setProgress(prev => ({ ...prev, phase: 'error' }))
          }
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
        setProgress(prev => ({ 
          ...prev, 
          phase: data.status === 'success' ? 'complete' : 'error',
          elapsedMs: Date.now() - prev.startTime
        }))
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
        setProgress(prev => ({ ...prev, phase: 'error' }))
        onStatusChange?.("failed")
        onComplete?.()
        eventSource.close()
        eventSourceRef.current = null
      } catch (err) {
        console.error("[Terminal] Error parsing error event:", err)
      }
    })

    eventSource.addEventListener("question", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Question event received:`, data)
        setQuestionPrompt(data.output || "Opencode is asking a question...")
        setQuestionType(data.questionType)
        setIsQuestionModalOpen(true)
        setAnswer("")
        
        // Pause progress when waiting for input
        setProgress(prev => ({
          ...prev,
          phase: 'waiting_input',
          waitingForQuestion: true,
          questionPrompt: data.output,
        }))
      } catch (err) {
        console.error("[Terminal] Error parsing question event:", err)
      }
    })

    eventSource.addEventListener("tool_start", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Tool start:`, data.tool, data.filePath)
        
        const toolExecution: ToolExecution = {
          id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          toolName: data.tool,
          status: 'running',
          filePath: data.filePath,
          startTime: Date.now(),
        }
        
        runningToolsRef.current.set(toolExecution.id, toolExecution)
        
        setProgress(prev => ({
          ...prev,
          phase: 'executing',
          currentTool: data.tool,
          currentFile: data.filePath,
          tools: [...prev.tools, toolExecution],
          totalTools: prev.totalTools + 1,
        }))
      } catch (err) {
        console.error("[Terminal] Error parsing tool_start event:", err)
      }
    })

    eventSource.addEventListener("tool_complete", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`[Terminal] Tool complete:`, data.tool)
        
        // Update the running tool to completed
        const tools = [...progress.tools]
        const lastTool = tools[tools.length - 1]
        if (lastTool && lastTool.status === 'running') {
          lastTool.status = 'completed'
          lastTool.endTime = Date.now()
          lastTool.result = data.result
          
          // Check if this was a file modification
          if (data.filePath && (data.tool === 'edit' || data.tool === 'write')) {
            addFileChange(data.filePath, data.tool === 'edit' ? 'modified' : 'created', data.additions || 0, data.deletions || 0)
          }
        }
        
        setProgress(prev => ({
          ...prev,
          tools,
          completedTools: prev.completedTools + 1,
          currentTool: undefined,
          currentFile: undefined,
        }))
      } catch (err) {
        console.error("[Terminal] Error parsing tool_complete event:", err)
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
  }, [executionId])

  // Detect tool calls from output text
  const detectToolCallsFromOutput = (text: string) => {
    // Simple regex to detect tool invocations
    const toolPatterns = [
      { pattern: /▶\s*(read|edit|write|bash|grep|search)\s+["']?([^"'\n]+)["']?/i, type: '$1' },
      { pattern: /(reading|editing|writing)\s+["']?([^"'\n]+)["']?/i, type: '$1' },
    ]
    
    for (const { pattern, type } of toolPatterns) {
      const match = text.match(pattern)
      if (match) {
        const toolName = match[1].toLowerCase()
        const filePath = match[2]
        
        // Don't add duplicate running tools
        const hasRunning = progress.tools.some(t => t.status === 'running' && t.toolName === toolName)
        if (!hasRunning) {
          const toolExecution: ToolExecution = {
            id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            toolName,
            status: 'running',
            filePath,
            startTime: Date.now(),
          }
          
          setProgress(prev => ({
            ...prev,
            phase: 'executing',
            currentTool: toolName,
            currentFile: filePath,
            tools: [...prev.tools, toolExecution],
            totalTools: prev.totalTools + 1,
          }))
        }
        break
      }
    }
  }

  // Add a file change to the list
  const addFileChange = (path: string, type: FileChange['type'], additions: number, deletions: number) => {
    setProgress(prev => {
      const existingIndex = prev.filesChanged.findIndex(f => f.path === path)
      
      if (existingIndex >= 0) {
        // Update existing
        const filesChanged = [...prev.filesChanged]
        filesChanged[existingIndex] = {
          ...filesChanged[existingIndex],
          type,
          additions: filesChanged[existingIndex].additions + additions,
          deletions: filesChanged[existingIndex].deletions + deletions,
        }
        return { ...prev, filesChanged }
      } else {
        // Add new
        return {
          ...prev,
          filesChanged: [...prev.filesChanged, { path, type, additions, deletions }],
        }
      }
    })
  }

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
            detectToolCallsFromOutput(result.output)
          }
          if (result.isComplete) {
            setStatus(result.status)
            onStatusChange?.(result.status)
            setProgress(prev => ({ 
              ...prev, 
              phase: result.status === 'success' ? 'complete' : 'error' 
            }))
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

  // Handle submitting answer to opencode
  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/executions/${executionId}/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: answer }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to submit answer: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`[Terminal] Answer submitted successfully`)
        setIsQuestionModalOpen(false)
        setQuestionPrompt("")
        setAnswer("")
        
        // Resume execution
        setProgress(prev => ({
          ...prev,
          phase: 'executing',
          waitingForQuestion: false,
          questionPrompt: undefined,
        }))
        
        // Append the user's answer to the output for visibility
        setOutput((prev) => prev + `\n\n[User Input]: ${answer}\n\n`)
      } else {
        console.error(`[Terminal] Failed to submit answer:`, result.error)
        alert(`Failed to submit answer: ${result.error}`)
      }
    } catch (err) {
      console.error("[Terminal] Error submitting answer:", err)
      alert(`Error submitting answer: ${err}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitAnswer()
    }
  }

  const showConnectionStatus = isRunning || isConnected
  
  // Parse output into segments (text and tool calls)
  const renderedSegments = useMemo(() => {
    if (!output) return []
    return parseToolCalls(output)
  }, [output])

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden bg-[#0a0b0d] border border-gray-800", className)}>
      {/* Execution Header with Repository Info */}
      {(isRunning || isConnected || progress.tools.length > 0) && (
        <div className="border-b border-gray-800">
          <ExecutionHeader 
            progress={progress} 
            repositoryInfo={repositoryInfo}
            className="p-3"
          />
        </div>
      )}

      {/* Terminal Header */}
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

      {/* Terminal Output */}
      <div
        ref={terminalRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-auto p-4 min-h-[300px] max-h-[500px]"
      >
        {!output ? (
          isRunning ? (
            <span className="text-gray-500 text-sm font-mono">Waiting for output...</span>
          ) : (
            <span className="text-gray-500 text-sm font-mono">No output available</span>
          )
        ) : (
          <div className="space-y-1">
            {renderedSegments.map((segment, index) => (
              <React.Fragment key={index}>
                {segment.type === "text" && segment.content && (
                  <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all leading-relaxed">
                    {segment.content}
                  </pre>
                )}
                {segment.type === "tool_call" && segment.toolCall && (
                  <ToolCallCard 
                    toolCall={segment.toolCall} 
                    isLive={isRunning && segment.toolCall.status === 'running'}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        {isRunning && output && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </div>

      {/* Question Modal */}
      <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Opencode Needs Your Input</DialogTitle>
            <DialogDescription>
              The AI is asking a question and needs your response to continue.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{questionPrompt}</p>
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="answer" className="text-sm font-medium">
                Your Answer
                {questionType && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({questionType === 'confirmation' ? 'yes/no' : questionType === 'choice' ? 'select an option' : 'type your response'})
                  </span>
                )}
              </label>
              <Input
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={questionType === 'confirmation' ? 'Type yes or no...' : 'Type your answer...'}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsQuestionModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAnswer}
              disabled={!answer.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Answer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
