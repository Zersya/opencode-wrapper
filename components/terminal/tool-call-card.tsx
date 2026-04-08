"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Copy, Check, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ToolCall } from "./tool-call-parser"
import { getToolIcon } from "./tool-call-parser"

interface ToolCallCardProps {
  toolCall: ToolCall
  className?: string
}

export function ToolCallCard({ toolCall, className }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  
  const icon = getToolIcon(toolCall.toolName)
  const hasResult = !!toolCall.result
  const argCount = Object.keys(toolCall.arguments).length
  
  const handleCopy = () => {
    if (toolCall.result) {
      navigator.clipboard.writeText(toolCall.result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  const statusConfig = {
    running: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      icon: <Clock className="w-4 h-4 animate-pulse" />,
      label: "Running",
    },
    completed: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      icon: <Check className="w-4 h-4" />,
      label: "Completed",
    },
    failed: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
      icon: <AlertCircle className="w-4 h-4" />,
      label: "Failed",
    },
  }
  
  const status = statusConfig[toolCall.status]
  
  return (
    <div
      className={cn(
        "my-2 rounded-lg border overflow-hidden transition-all duration-200",
        status.bg,
        status.border,
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
      
      {/* Arguments (if expanded or if there's no result to show) */}
      {(isExpanded || (!hasResult && argCount > 0)) && argCount > 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-black/10">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Arguments
          </p>
          <div className="space-y-1.5">
            {Object.entries(toolCall.arguments).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="text-gray-400 font-mono">{key}:</span>
                <span className="text-gray-300 font-mono truncate" title={value}>
                  {value.length > 60 ? value.slice(0, 60) + "..." : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Result (if expanded) */}
      {hasResult && isExpanded && (
        <div className="px-4 py-3 border-t border-white/10 bg-black/30">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Result
          </p>
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-auto">
            {toolCall.result}
          </pre>
        </div>
      )}
      
      {/* Preview when collapsed */}
      {hasResult && !isExpanded && (
        <div className="px-4 py-2 border-t border-white/5 bg-black/10">
          <p className="text-xs text-gray-500 truncate">
            {toolCall.result.slice(0, 100)}
            {toolCall.result.length > 100 ? "..." : ""}
          </p>
        </div>
      )}
    </div>
  )
}

function formatToolName(name: string): string {
  // Convert snake_case to Title Case
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
