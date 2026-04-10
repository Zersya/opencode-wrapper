"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Copy, Check, Download, X } from "lucide-react"

interface CodePreviewProps {
  filename: string
  content: string
  language?: string
  onClose?: () => void
  className?: string
}

export function CodePreview({ 
  filename, 
  content, 
  language,
  onClose,
  className 
}: CodePreviewProps) {
  const [copied, setCopied] = React.useState(false)
  
  const detectedLanguage = language || detectLanguage(filename)
  const lines = content.split('\n')
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  return (
    <div className={cn("flex flex-col h-full bg-[#0a0b0d] rounded-lg border border-gray-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1d21] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300 font-mono">{filename}</span>
          <span className="text-xs text-gray-500">{detectedLanguage}</span>
          <span className="text-xs text-gray-600">{lines.length} lines</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-400 hover:text-white"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-400 hover:text-white"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-gray-400 hover:text-white"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Code Content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="hover:bg-white/5">
                <td className="px-3 py-0.5 text-right select-none w-12 bg-black/20">
                  <span className="text-xs text-gray-600 font-mono">{index + 1}</span>
                </td>
                <td className="px-4 py-0.5">
                  <pre className="text-sm font-mono text-gray-300 whitespace-pre">
                    {line || ' '}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  const languageMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React JSX',
    'tsx': 'React TSX',
    'py': 'Python',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'h': 'C Header',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown',
    'sql': 'SQL',
    'sh': 'Shell',
    'bash': 'Bash',
    'zsh': 'Zsh',
    'dockerfile': 'Dockerfile',
    'vue': 'Vue',
    'svelte': 'Svelte',
    'php': 'PHP',
  }
  
  return languageMap[ext || ''] || 'Text'
}
