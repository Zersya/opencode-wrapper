"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  Loader2,
  FileCode,
  FolderOpen,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ToolCall } from "./tool-call-parser"
import { getToolIcon } from "./tool-call-parser"

interface ToolCallCardProps {
  toolCall: ToolCall
  className?: string
  isLive?: boolean
}

export function ToolCallCard({ toolCall, className, isLive = false }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(toolCall.status === 'running')
  const [copied, setCopied] = React.useState(false)
  const [localResult, setLocalResult] = React.useState(toolCall.result || "")
  
  // Update local result when toolCall changes (for live updates)
  React.useEffect(() => {
    if (toolCall.result && toolCall.result !== localResult) {
      setLocalResult(toolCall.result)
    }
  }, [toolCall.result, localResult])
  
  const icon = getToolIcon(toolCall.toolName)
  const hasResult = !!localResult
  const argCount = Object.keys(toolCall.arguments).length
  
  const handleCopy = () => {
    if (localResult) {
      navigator.clipboard.writeText(localResult)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  const statusConfig = {
    running: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      label: "Running",
      pulse: true,
    },
    completed: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      icon: <Check className="w-4 h-4" />,
      label: "Completed",
      pulse: false,
    },
    failed: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
      icon: <AlertCircle className="w-4 h-4" />,
      label: "Failed",
      pulse: false,
    },
  }
  
  const status = statusConfig[toolCall.status]
  
  // Detect if result is code/file content
  const isCodeResult = localResult && (
    localResult.includes('```') ||
    localResult.match(/^\s*[\{\[]/) ||
    localResult.match(/^\s*function|class|const|let|var|import|export/) ||
    localResult.match(/^\s*def|class|import|from/) ||
    localResult.match(/^\s*<\?xml|xmlns/) ||
    localResult.match(/^\s*<\/?[a-zA-Z]/)
  )
  
  // Detect if result is a file path
  const isFilePath = localResult && localResult.match(/^\/[\w\-\/.]+$/)
  
  return (
    <div
      className={cn(
        "my-2 rounded-lg border overflow-hidden transition-all duration-300",
        status.bg,
        status.border,
        status.pulse && "animate-pulse",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div className="flex items-center gap-3">
          <span className="text-lg" role="img" aria-label={toolCall.toolName}>
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-200">
              {formatToolName(toolCall.toolName)}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("flex items-center gap-1 text-xs", status.text)}>
                {status.icon}
                {status.label}
              </span>
              {toolCall.duration && (
                <span className="text-xs text-gray-500">
                  • {toolCall.duration}
                </span>
              )}
              {isLive && toolCall.status === 'running' && (
                <span className="text-xs text-amber-400 animate-pulse">
                  • Live
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasResult && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-200"
              onClick={handleCopy}
              title="Copy result"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          )}
          
          {(hasResult || argCount > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-200"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Arguments */}
      {(isExpanded || (!hasResult && argCount > 0)) && argCount > 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-black/10">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Arguments
          </p>
          <div className="space-y-1.5">
            {Object.entries(toolCall.arguments).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="text-gray-400 font-mono text-xs">{key}:</span>
                <span 
                  className={cn(
                    "text-gray-300 font-mono text-xs",
                    value.length > 60 && "truncate"
                  )} 
                  title={value}
                >
                  {value.length > 80 ? value.slice(0, 80) + "..." : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Result */}
      {hasResult && isExpanded && (
        <div className="px-4 py-3 border-t border-white/10 bg-black/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Result
            </p>
            {isCodeResult && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                Code
              </span>
            )}
            {isFilePath && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                File Path
              </span>
            )}
          </div>
          <div 
            className={cn(
              "text-xs font-mono text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-auto p-2 rounded",
              isCodeResult && "bg-gray-900/50 border border-gray-800"
            )}
          >
            {isFilePath ? (
              <span className="flex items-center gap-1 text-blue-400">
                <ExternalLink className="w-3 h-3" />
                {localResult}
              </span>
            ) : (
              localResult
            )}
          </div>
        </div>
      )}
      
      {/* Preview when collapsed */}
      {hasResult && !isExpanded && (
        <div className="px-4 py-2 border-t border-white/5 bg-black/10">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 truncate flex-1">
              {localResult.slice(0, 100)}
              {localResult.length > 100 ? "..." : ""}
            </p>
            {isLive && toolCall.status === 'running' && (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin flex-shrink-0" />
            )}
          </div>
        </div>
      )}
      
      {/* Live progress indicator */}
      {isLive && toolCall.status === 'running' && (
        <div className="px-4 py-2 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400/50 animate-pulse rounded-full" 
                   style={{ width: '60%' }} />
            </div>
            <span className="text-xs text-gray-500">Processing...</span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatToolName(name: string): string {
  return name
    .split(/[_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
