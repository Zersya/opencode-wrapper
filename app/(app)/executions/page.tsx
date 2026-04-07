"use client"

import * as React from "react"
import Link from "next/link"
import { Terminal, Clock, ArrowRight, Loader2, RefreshCw, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ExecutionStatus } from "@/components/terminal"
import { getAllExecutions } from "@/lib/actions/executions"
import type { TaskExecution } from "@/lib/db/schema"
import { formatDistanceToNow } from "date-fns"

interface ExecutionWithDetails extends TaskExecution {
  task?: { id: number; title: string; projectId: number }
  organization?: { id: number; name: string; slug: string }
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = React.useState<ExecutionWithDetails[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")

  const loadExecutions = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAllExecutions()
      // Sort by createdAt descending (newest first)
      const sorted = data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })
      setExecutions(sorted)
    } catch (error) {
      console.error("Failed to load executions:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadExecutions()
  }, [loadExecutions])

  const filteredExecutions = React.useMemo(() => {
    if (!searchQuery.trim()) return executions
    const query = searchQuery.toLowerCase()
    return executions.filter(
      (e) =>
        e.task?.title.toLowerCase().includes(query) ||
        e.command.toLowerCase().includes(query) ||
        e.status.toLowerCase().includes(query)
    )
  }, [executions, searchQuery])

  const runningCount = executions.filter((e) => e.status === "running").length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-gray-400" />
            Executions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {executions.length} total
            {runningCount > 0 && (
              <span className="ml-2 text-amber-400">{runningCount} running</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-gray-700"
            onClick={loadExecutions}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by task, command, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700"
            />
          </div>

          {/* Executions List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="text-center py-12">
              <Terminal className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium text-white mb-1">
                {searchQuery ? "No executions found" : "No executions yet"}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Executions will appear here when you run OpenCode commands from tasks"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExecutions.map((execution) => (
                <Link
                  key={execution.id}
                  href={`/executions/${execution.id}`}
                  className="block"
                >
                  <Card className="bg-[#1a1d21] border-gray-800 hover:border-gray-700 transition-colors group">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Status */}
                          <div className="flex-shrink-0">
                            <ExecutionStatus status={execution.status} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate">
                                #{execution.id} {execution.task?.title || "Unknown Task"}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs bg-gray-800 text-gray-400 flex-shrink-0"
                              >
                                {execution.organization?.name || "Unknown"}
                              </Badge>
                            </div>
                            <code className="text-xs text-gray-500 font-mono block truncate">
                              opencode {execution.command}
                            </code>
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {execution.createdAt
                                ? formatDistanceToNow(new Date(execution.createdAt), {
                                    addSuffix: true,
                                  })
                                : "Unknown"}
                            </span>
                          </div>
                          {execution.exitCode !== null && execution.exitCode !== undefined && (
                            <span
                              className={cn(
                                "font-mono",
                                execution.exitCode === 0 ? "text-green-400" : "text-red-400"
                              )}
                            >
                              exit: {execution.exitCode}
                            </span>
                          )}
                          <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
