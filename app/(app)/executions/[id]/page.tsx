"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Calendar, Terminal, User, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TerminalOutputViewer, ExecutionControls } from "@/components/terminal"
import { executeTask, cancelExecution, retryExecution } from "@/lib/actions/executions"
import type { TaskExecution } from "@/lib/db/schema"

const mockExecutions: (TaskExecution & {
  task?: { id: number; title: string }
  user?: { id: string; name: string }
  organization?: { id: number; name: string }
})[] = [
  {
    id: 1,
    taskId: 1,
    userId: "user_1",
    organizationId: 1,
    status: "success",
    command: "implement authentication flow",
    workingDirectory: "/workspace/opencode-wrapper",
    output: `$ opencode implement authentication flow

⠋ Analyzing project structure...
⠋ Checking dependencies...
✓ Dependencies installed
⠋ Generating authentication code...
✓ Created /lib/auth.ts
✓ Created /middleware.ts
✓ Created /app/(auth)/sign-in/page.tsx
✓ Created /app/(auth)/sign-up/page.tsx

⠋ Running type checks...
✓ Type checks passed

⠋ Running linting...
✓ Linting passed

✅ Task completed successfully!

Files modified:
  - lib/auth.ts (created)
  - middleware.ts (created)
  - app/(auth)/sign-in/page.tsx (created)
  - app/(auth)/sign-up/page.tsx (created)

Next steps:
  1. Configure your Clerk keys in .env.local
  2. Test the authentication flow
  3. Add protected routes as needed

Execution time: 45.2s
Exit code: 0`,
    exitCode: 0,
    startedAt: new Date(Date.now() - 1000 * 60 * 60),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 + 45000),
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    task: { id: 1, title: "Implement authentication flow with Clerk" },
    user: { id: "user_1", name: "John Doe" },
    organization: { id: 1, name: "Emdash Labs" },
  },
  {
    id: 2,
    taskId: 4,
    userId: "user_1",
    organizationId: 1,
    status: "running",
    command: "implement docker isolation for CLI",
    workingDirectory: "/workspace/api-gateway",
    output: `$ opencode implement docker isolation for CLI

⠋ Analyzing requirements...
⠋ Checking Docker API availability...
✓ Docker connection established
⠋ Creating container manager module...

> Creating lib/server/docker-manager.ts
  - Container creation logic
  - Container lifecycle management
  - Volume mounting configuration

⠋ Implementing CLI executor...`,
    startedAt: new Date(Date.now() - 1000 * 30),
    createdAt: new Date(Date.now() - 1000 * 30),
    task: { id: 4, title: "Create Docker isolation for CLI execution" },
    user: { id: "user_1", name: "John Doe" },
    organization: { id: 1, name: "Emdash Labs" },
  },
  {
    id: 3,
    taskId: 5,
    userId: "user_1",
    organizationId: 1,
    status: "failed",
    command: "implement real-time output streaming",
    workingDirectory: "/workspace/opencode-wrapper",
    output: `$ opencode implement real-time output streaming

⠋ Analyzing requirements...
⠋ Checking existing implementation...
✓ Found existing code structure
⠋ Implementing streaming logic...

❌ Error occurred during execution:

Error: Missing dependency 'ws' for WebSocket support
  at checkDependencies (src/executor.ts:45)
  at runExecution (src/executor.ts:89)

To fix this issue:
  1. Run: npm install ws
  2. Add types: npm install -D @types/ws
  3. Retry the execution

Execution time: 12.3s
Exit code: 1`,
    exitCode: 1,
    startedAt: new Date(Date.now() - 1000 * 60 * 120),
    completedAt: new Date(Date.now() - 1000 * 60 * 120 + 12300),
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    task: { id: 5, title: "Build real-time output streaming" },
    user: { id: "user_1", name: "John Doe" },
    organization: { id: 1, name: "Emdash Labs" },
  },
]

export default function ExecutionPage() {
  const params = useParams()
  const router = useRouter()
  const executionId = parseInt(params.id as string, 10)
  const execution = mockExecutions.find((e) => e.id === executionId)

  const [status, setStatus] = React.useState(execution?.status || "pending")

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Execution not found</h2>
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
                executionId={executionId}
                initialOutput={execution.output || ""}
                initialStatus={status}
                onStatusChange={setStatus}
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
