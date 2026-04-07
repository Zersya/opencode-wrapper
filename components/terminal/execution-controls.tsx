"use client"

import * as React from "react"
import { Play, Square, RotateCcw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TaskExecution } from "@/lib/db/schema"

interface ExecutionControlsProps {
  execution: TaskExecution
  onExecute?: () => void
  onStop?: () => void
  onRetry?: () => void
  className?: string
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-gray-400",
    bgColor: "bg-gray-500",
    badgeVariant: "secondary" as const,
  },
  running: {
    label: "Running",
    icon: Loader2,
    color: "text-amber-400",
    bgColor: "bg-amber-500",
    badgeVariant: "default" as const,
  },
  success: {
    label: "Success",
    icon: CheckCircle2,
    color: "text-green-400",
    bgColor: "bg-green-500",
    badgeVariant: "default" as const,
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-500",
    badgeVariant: "destructive" as const,
  },
  canceled: {
    label: "Canceled",
    icon: Square,
    color: "text-gray-500",
    bgColor: "bg-gray-600",
    badgeVariant: "secondary" as const,
  },
}

export function ExecutionControls({
  execution,
  onExecute,
  onStop,
  onRetry,
  className,
}: ExecutionControlsProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const status = statusConfig[execution.status]
  const StatusIcon = status.icon
  const isRunning = execution.status === "running"
  const isPending = execution.status === "pending"
  const isComplete = ["success", "failed", "canceled"].includes(execution.status)

  const handleAction = async (action: () => void) => {
    setIsLoading(true)
    try {
      action()
    } finally {
      setTimeout(() => setIsLoading(false), 500)
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Status Badge */}
      <Badge
        variant={status.badgeVariant}
        className={cn(
          "gap-1.5",
          execution.status === "success" && "bg-green-500/20 text-green-400 border-green-500/30",
          execution.status === "failed" && "bg-red-500/20 text-red-400 border-red-500/30",
          execution.status === "running" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
          execution.status === "pending" && "bg-gray-500/20 text-gray-400 border-gray-500/30",
          execution.status === "canceled" && "bg-gray-600/20 text-gray-500 border-gray-600/30"
        )}
      >
        <StatusIcon className={cn("h-3 w-3", isRunning && "animate-spin")} />
        {status.label}
      </Badge>

      {/* Exit Code (if available) */}
      {execution.exitCode !== null && execution.exitCode !== undefined && (
        <span className="text-xs text-gray-500 font-mono">
          exit: {execution.exitCode}
        </span>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isPending && onExecute && (
          <Button
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90"
            onClick={() => handleAction(onExecute)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Start
          </Button>
        )}

        {isRunning && onStop && (
          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            onClick={() => handleAction(onStop)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )}
            Stop
          </Button>
        )}

        {isComplete && onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-gray-700"
            onClick={() => handleAction(onRetry)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

export function ExecutionStatus({
  status,
  className,
}: {
  status: TaskExecution["status"]
  className?: string
}) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />
      <Icon className={cn("h-4 w-4", config.color, status === "running" && "animate-spin")} />
      <span className={cn("text-sm font-medium", config.color)}>
        {config.label}
      </span>
    </div>
  )
}
