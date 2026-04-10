"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { 
  GitBranch, 
  FolderGit, 
  Clock, 
  FileCode, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  PauseCircle,
  ChevronDown,
  ChevronUp,
  Diff
} from "lucide-react"
import type { ExecutionProgress, ExecutionPhase, FileChange, ToolExecution } from "@/lib/terminal/progress-types"
import { PHASE_MESSAGES, formatDuration, getActiveToolText } from "@/lib/terminal/progress-types"

// Tool icon mapping
const TOOL_ICONS: Record<string, string> = {
  read: '📄',
  edit: '✏️',
  write: '📝',
  bash: '💻',
  grep: '🔍',
  search: '🔍',
  glob: '📁',
  codebase_retrieval: '🔎',
  augment_context_engine_codebase_retrieval: '🔎',
  webfetch: '🌐',
  task: '📌',
  todowrite: '☑️',
  skill: '🎯',
  default: '🔧',
}

interface ExecutionHeaderProps {
  progress: ExecutionProgress
  repositoryInfo?: {
    name: string
    branch: string
    commit?: string
    filesChanged?: number
  }
  className?: string
}

export function ExecutionHeader({ 
  progress, 
  repositoryInfo,
  className 
}: ExecutionHeaderProps) {
  const [showChanges, setShowChanges] = React.useState(false)
  const currentToolText = getActiveToolText(progress.currentTool, progress.currentFile)
  
  // Calculate progress percentage
  const progressPercent = Math.round((progress.completedTools / Math.max(1, progress.totalTools)) * 100)
  const hasChanges = progress.filesChanged.length > 0
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Repository Context Bar */}
      {repositoryInfo && (
        <div className="flex items-center gap-4 px-3 py-2 bg-[#1a1d21] rounded-lg border border-gray-800">
          <div className="flex items-center gap-2">
            <FolderGit className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 font-medium">{repositoryInfo.name}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <GitBranch className="w-3 h-3" />
            <span>{repositoryInfo.branch}</span>
          </div>
          
          {repositoryInfo.commit && (
            <span className="text-xs text-gray-600 font-mono">
              {repositoryInfo.commit.slice(0, 7)}
            </span>
          )}
          
          {hasChanges && (
            <button
              onClick={() => setShowChanges(!showChanges)}
              className="flex items-center gap-1.5 ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Diff className="w-3 h-3" />
              <span>{progress.filesChanged.length} file{progress.filesChanged.length !== 1 ? 's' : ''} changed</span>
              {showChanges ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}
      
      {/* Main Progress Bar */}
      <div className="px-3 py-3 bg-[#0f1012] rounded-lg border border-gray-800">
        {/* Status Line */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Phase Indicator */}
            <PhaseIndicator phase={progress.phase} />
            
            {/* Current Activity */}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-200">
                {PHASE_MESSAGES[progress.phase]}
              </span>
              {currentToolText && progress.phase === 'executing' && (
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span>{TOOL_ICONS[progress.currentTool?.toLowerCase() || 'default']}</span>
                  {currentToolText}
                </span>
              )}
            </div>
          </div>
          
          {/* Time & Stats */}
          <div className="flex items-center gap-3 text-xs">
            {progress.totalTools > 0 && progress.phase === 'executing' && (
              <span className="text-gray-500 font-mono">
                {progress.completedTools}/{progress.totalTools} tools
              </span>
            )}
            <span className="text-gray-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(progress.elapsedMs)}
            </span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              progress.phase === 'error' && "bg-red-500",
              progress.phase === 'waiting_input' && "bg-amber-500",
              progress.phase === 'complete' && "bg-green-500",
              !['error', 'waiting_input', 'complete'].includes(progress.phase) && "bg-blue-500"
            )}
            style={{ 
              width: `${progress.phase === 'executing' 
                ? Math.min(95, 20 + (progress.completedTools / Math.max(1, progress.totalTools)) * 75)
                : ['complete'].includes(progress.phase) ? 100 : ['waiting_input'].includes(progress.phase) ? 60 : 20
              }%` 
            }}
          />
        </div>
        
        {/* Tool History (only show last 3 completed + current) */}
        {progress.tools.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800/50">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {progress.tools.slice(-4).map((tool, idx) => (
                <ToolBadge 
                  key={tool.id} 
                  tool={tool} 
                  isCurrent={idx === progress.tools.slice(-4).length - 1 && tool.status === 'running'}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Changes Panel */}
      {showChanges && hasChanges && (
        <div className="px-3 py-3 bg-[#0f1012] rounded-lg border border-gray-800">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Changes ({progress.filesChanged.length} files)
          </h4>
          <div className="space-y-2">
            {progress.filesChanged.map((file) => (
              <FileChangeItem key={file.path} change={file} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Phase indicator component
function PhaseIndicator({ phase }: { phase: ExecutionPhase }) {
  const configs = {
    connecting: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    analyzing: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    planning: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    executing: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    waiting_input: { icon: <PauseCircle className="w-4 h-4" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    complete: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/10' },
    error: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/10' },
  }
  
  const config = configs[phase]
  
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", config.bg)}>
      <span className={config.color}>{config.icon}</span>
    </div>
  )
}

// Tool badge component
function ToolBadge({ tool, isCurrent }: { tool: ToolExecution; isCurrent?: boolean }) {
  const icon = TOOL_ICONS[tool.toolName.toLowerCase()] || TOOL_ICONS.default
  const shortFile = tool.filePath?.split('/').pop()
  
  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs whitespace-nowrap",
        tool.status === 'running' && isCurrent && "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50",
        tool.status === 'completed' && "bg-green-500/10 text-green-400",
        tool.status === 'failed' && "bg-red-500/10 text-red-400",
      )}
    >
      <span>{icon}</span>
      <span className="font-medium">{tool.toolName}</span>
      {shortFile && (
        <span className="text-gray-500">{shortFile}</span>
      )}
      {tool.status === 'running' && isCurrent && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
    </div>
  )
}

// File change item component
function FileChangeItem({ change }: { change: FileChange }) {
  const typeIcons = {
    modified: <FileCode className="w-3 h-3 text-blue-400" />,
    created: <FileCode className="w-3 h-3 text-green-400" />,
    deleted: <FileCode className="w-3 h-3 text-red-400" />,
  }
  
  return (
    <div className="flex items-center gap-2 text-xs">
      {typeIcons[change.type]}
      <span className="text-gray-300 font-mono truncate flex-1">{change.path}</span>
      <div className="flex items-center gap-1.5">
        {change.additions > 0 && (
          <span className="text-green-400">+{change.additions}</span>
        )}
        {change.deletions > 0 && (
          <span className="text-red-400">-{change.deletions}</span>
        )}
      </div>
    </div>
  )
}
