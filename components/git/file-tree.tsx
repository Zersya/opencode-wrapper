"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  File, 
  FileCode, 
  FileText,
  FileJson,
  FileType,
  Image as ImageIcon
} from "lucide-react"

export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  size?: number
  modifiedAt?: Date
}

interface FileTreeProps {
  nodes: FileNode[]
  selectedPath?: string
  onSelect?: (node: FileNode) => void
  onToggle?: (node: FileNode, isExpanded: boolean) => void
  className?: string
}

export function FileTree({ 
  nodes, 
  selectedPath, 
  onSelect, 
  onToggle,
  className 
}: FileTreeProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  selectedPath?: string
  onSelect?: (node: FileNode) => void
  onToggle?: (node: FileNode, isExpanded: boolean) => void
}

function FileTreeNode({ 
  node, 
  depth, 
  selectedPath, 
  onSelect, 
  onToggle 
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const isSelected = selectedPath === node.path
  const isDirectory = node.type === "directory"
  
  const handleClick = () => {
    if (isDirectory) {
      const newExpanded = !isExpanded
      setIsExpanded(newExpanded)
      onToggle?.(node, newExpanded)
    } else {
      onSelect?.(node)
    }
  }
  
  const fileIcon = getFileIcon(node.name, isDirectory, isExpanded)
  
  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors",
          isSelected 
            ? "bg-primary/20 text-primary" 
            : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDirectory && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
        )}
        <span className="flex-shrink-0">{fileIcon}</span>
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && !isDirectory && (
          <span className="text-xs text-gray-600 ml-auto">
            {formatFileSize(node.size)}
          </span>
        )}
      </button>
      
      {isDirectory && isExpanded && node.children && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function getFileIcon(filename: string, isDirectory: boolean, isExpanded: boolean) {
  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen className="w-4 h-4 text-amber-400" />
    ) : (
      <Folder className="w-4 h-4 text-amber-400" />
    )
  }
  
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'vue':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'cpp':
    case 'c':
    case 'h':
      return <FileCode className="w-4 h-4 text-blue-400" />
    case 'json':
    case 'yaml':
    case 'yml':
      return <FileJson className="w-4 h-4 text-yellow-400" />
    case 'md':
    case 'txt':
    case 'log':
      return <FileText className="w-4 h-4 text-gray-400" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <ImageIcon className="w-4 h-4 text-purple-400" />
    case 'html':
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <FileType className="w-4 h-4 text-orange-400" />
    default:
      return <File className="w-4 h-4 text-gray-500" />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
