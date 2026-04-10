"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Clock, GitBranch, Server, Brain, ListTodo, Wrench, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import type { ExecutionPhase } from "@/lib/terminal/progress-types"
import { PHASE_MESSAGES } from "@/lib/terminal/progress-types"

interface ProgressTimelineProps {
  phase: ExecutionPhase
  progressPercent: number
  currentTool?: string
  elapsedMs: number
  className?: string
}

const PHASE_ICONS: Record<ExecutionPhase, React.ReactNode> = {
  initializing: <Loader2 className="w-4 h-4 animate-spin" />,
  cloning_repository: <GitBranch className="w-4 h-4" />,
  starting_session: <Server className="w-4 h-4" />,
  analyzing: <Brain className="w-4 h-4" />,
  planning: <ListTodo className="w-4 h-4" />,
  executing_tools: <Wrench className="w-4 h-4" />,
  processing_results: <Loader2 className="w-4 h-4 animate-spin" />,
  finalizing: <CheckCircle className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4 text-green-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
}

interface PhaseDisplay {
  id: string
  label: string
  short?: boolean
}

const PHASES_DISPLAY: PhaseDisplay[] = [
  { id: 'initializing', label: 'Setup', short: true },
  { id: 'cloning_repository', label: 'Clone', short: true },
  { id: 'starting_session', label: 'Session', short: true },
  { id: 'analyzing', label: 'Analyze' },
  { id: 'planning', label: 'Plan' },
  { id: 'executing_tools', label: 'Execute' },
  { id: 'processing_results', label: 'Process' },
  { id: 'finalizing', label: 'Finalize', short: true },
]

export function ProgressTimeline({
  phase,
  progressPercent,
  currentTool,
  elapsedMs,
  className,
}: ProgressTimelineProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const currentPhaseIndex = PHASES_DISPLAY.findIndex(p => p.id === phase)
  const isComplete = phase === 'completed' || phase === 'error'

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 flex items-center gap-1.5">
            {PHASE_ICONS[phase]}
            {PHASE_MESSAGES[phase]}
            {currentTool && (
              <span className="text-gray-500 ml-1">
                • {currentTool}
              </span>
            )}
          </span>
          <span className="text-gray-500 font-mono">
            {formatDuration(elapsedMs)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              phase === 'error' ? "bg-red-500" : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="flex items-center gap-1">
        {PHASES_DISPLAY.map((p, index) => {
          const isActive = index === currentPhaseIndex
          const isPast = index < currentPhaseIndex && !isComplete
          const isFuture = index > currentPhaseIndex && !isComplete

          return (
            <React.Fragment key={p.id}>
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-300",
                  p.short ? "w-5 h-5" : "w-6 h-6",
                  isActive && "bg-primary/20 ring-2 ring-primary",
                  isPast && "bg-green-500/20",
                  isFuture && "bg-gray-800",
                  phase === 'error' && isActive && "bg-red-500/20 ring-2 ring-red-500"
                )}
                title={p.label}
              >
                {isPast ? (
                  <CheckCircle className={cn("w-3 h-3 text-green-400", p.short && "w-2.5 h-2.5")} />
                ) : (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isActive && "text-primary",
                      isPast && "text-green-400",
                      isFuture && "text-gray-600"
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              {index < PHASES_DISPLAY.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1 transition-all duration-300",
                    index < currentPhaseIndex ? "bg-green-500/30" : "bg-gray-800"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
