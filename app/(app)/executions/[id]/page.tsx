"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Calendar, Terminal, User, GitBranch, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TerminalOutputViewer, ExecutionControls } from "@/components/terminal"
import { getExecutionWithDetails, cancelExecution, retryExecution } from "@/lib/actions/executions"
import type { TaskExecution } from "@/lib/db/schema"

interface ExecutionWithDetails extends TaskExecution {
  task?: { id: number; title: string; opencodeCommand: string | null }
  user?: { id: string; name: string }
  organization?: { id: number; name: string }
}

export default function ExecutionPage() {
  const params = useParams()
  const router = useRouter()
  const executionId = parseInt(params.id as string, 10)
  
  const [execution, setExecution] = React.useState<ExecutionWithDetails | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<TaskExecution["status"]>("pending")

  React.useEffect(() => {
    async function loadExecution() {
      try {
        setIsLoading(true)
        const data = await getExecutionWithDetails(executionId)
        if (data) {
          setExecution(data)
          setStatus(data.status)
        } else {
          setError("Execution not found")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load execution")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadExecution()
  }, [executionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !execution) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            {error || "Execution not found"}
          </h2>
          <p className="text-gray-400">The execution you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const handleStop = async () => {
    await cancelExecution(executionId)
    setStatus("canceled")
  }

  const handleRetry = async () => {
    const newExecution = await retryExecution(executionId)
    router.push(`/executions/${newExecution.id}`)
  }

  const formatDuration = () => {
    if (!execution.startedAt || !execution.completedAt) return null
    const ms = execution.completedAt.getTime() - execution.startedAt.getTime()
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Link
            href={`/tasks/${execution.taskId}`}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">
              Execution #{executionId}
            </h1>
            <p className="text-sm text-gray-500">{execution.task?.title}</p>
          </div>
        </div>

        <ExecutionControls
          execution={{ ...execution, status }}
          onStop={handleStop}
          onRetry={handleRetry}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Terminal Output */}
          <Card className="bg-[#1a1d21] border-gray-800">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4 text-gray-400" />
                Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TerminalOutputViewer
                key={`terminal-${executionId}`}
                executionId={executionId}
                initialOutput={execution.output || ""}
                initialStatus={status}
                onStatusChange={(newStatus) => setStatus(newStatus as TaskExecution["status"])}
              />
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Execution Details */}
            <Card className="bg-[#1a1d21] border-gray-800">
              <CardHeader>
                <CardTitle className="text-base">Execution Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Command</span>
                  <code className="text-sm text-gray-300 font-mono bg-gray-800 px-2 py-1 rounded">
                    opencode {execution.command}
                  </code>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Working Directory</span>
                  <code className="text-sm text-gray-400 font-mono">
                    {execution.workingDirectory}
                  </code>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Duration</span>
                  <span className="text-sm text-white">
                    {formatDuration() || "—"}
                  </span>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Exit Code</span>
                  <span className={cn(
                    "text-sm font-mono",
                    execution.exitCode === 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {execution.exitCode ?? "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Context */}
            <Card className="bg-[#1a1d21] border-gray-800">
              <CardHeader>
                <CardTitle className="text-base">Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <User className="h-3 w-3" />
                    Triggered by
                  </span>
                  <span className="text-sm text-white">{execution.user?.name}</span>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <GitBranch className="h-3 w-3" />
                    Organization
                  </span>
                  <span className="text-sm text-white">{execution.organization?.name}</span>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Started
                  </span>
                  <span className="text-sm text-white">
                    {execution.startedAt?.toLocaleString() || "Not started"}
                  </span>
                </div>
                <Separator className="bg-gray-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Completed
                  </span>
                  <span className="text-sm text-white">
                    {execution.completedAt?.toLocaleString() || "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
