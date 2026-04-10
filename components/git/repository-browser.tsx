"use client"

import * as React from "react"
import { Search, GitBranch, Lock, Globe, ExternalLink, RefreshCw, FolderTree, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Repository } from "@/lib/git/actions"
import { FileTree, type FileNode } from "./file-tree"
import { CodePreview } from "./code-preview"

interface RepositoryBrowserProps {
  repositories: Repository[]
  onSelect?: (repo: Repository) => void
  selectedId?: string
  className?: string
  loading?: boolean
  onRefresh?: () => void
  fileTree?: FileNode[]
  fileTreeLoading?: boolean
  onFileSelect?: (path: string) => Promise<{ content: string; error?: string }>
}

export function RepositoryBrowser({
  repositories,
  onSelect,
  selectedId,
  className,
  loading = false,
  onRefresh,
  fileTree,
  fileTreeLoading = false,
  onFileSelect,
}: RepositoryBrowserProps) {
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"repositories" | "files">("repositories")
  const [selectedFile, setSelectedFile] = React.useState<FileNode | null>(null)
  const [fileContent, setFileContent] = React.useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = React.useState(false)
  const [selectedRepo, setSelectedRepo] = React.useState<Repository | null>(null)

  const filtered = React.useMemo(() => {
    if (!search.trim()) return repositories
    const query = search.toLowerCase()
    return repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.fullName.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query)
    )
  }, [repositories, search])

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo)
    setActiveTab("files")
    setSelectedFile(null)
    setFileContent(null)
    onSelect?.(repo)
  }

  const handleFileSelect = async (node: FileNode) => {
    if (node.type === "file" && onFileSelect) {
      setSelectedFile(node)
      setIsLoadingFile(true)
      try {
        const result = await onFileSelect(node.path)
        if (!result.error) {
          setFileContent(result.content)
        }
      } catch (error) {
        console.error("Failed to load file:", error)
      } finally {
        setIsLoadingFile(false)
      }
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-800 border-gray-700"
          />
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="border-gray-700"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 mb-4">
          <TabsTrigger value="repositories" className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" />
            Repositories
            <Badge variant="secondary" className="ml-1 text-xs bg-gray-700">
              {repositories.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="files" 
            className="flex items-center gap-2"
            disabled={!selectedRepo}
          >
            <FolderTree className="h-3.5 w-3.5" />
            Files
            {selectedRepo && (
              <span className="text-xs text-gray-500 truncate max-w-[100px]">
                {selectedRepo.name}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="flex-1 overflow-y-auto m-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? "No repositories found" : "No repositories available"}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelect(repo)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-colors",
                    selectedId === repo.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-[#1a1d21] border-gray-800 hover:bg-gray-800/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <GitBranch className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-white truncate">
                          {repo.fullName}
                        </span>
                        {repo.isPrivate ? (
                          <Lock className="h-3 w-3 text-gray-500 flex-shrink-0" />
                        ) : (
                          <Globe className="h-3 w-3 text-gray-500 flex-shrink-0" />
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {repo.defaultBranch}
                        </span>
                        <span>
                          Updated {formatRelativeTime(repo.updatedAt)}
                        </span>
                        {repo.stars !== undefined && repo.stars > 0 && (
                          <span>★ {repo.stars}</span>
                        )}
                      </div>
                    </div>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="flex-1 m-0">
          {selectedRepo ? (
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* File Tree */}
              <Card className="bg-[#1a1d21] border-gray-800 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    {selectedRepo.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedRepo.defaultBranch} • {fileTree?.length || 0} items
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto max-h-[400px]">
                  {fileTreeLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
                    </div>
                  ) : fileTree && fileTree.length > 0 ? (
                    <div className="p-2">
                      <FileTree
                        nodes={fileTree}
                        selectedPath={selectedFile?.path}
                        onSelect={handleFileSelect}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No files to display
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Preview */}
              <div className="h-full">
                {selectedFile && fileContent ? (
                  <CodePreview
                    filename={selectedFile.name}
                    content={fileContent}
                    onClose={() => {
                      setSelectedFile(null)
                      setFileContent(null)
                    }}
                    className="h-full"
                  />
                ) : isLoadingFile ? (
                  <Card className="h-full bg-[#1a1d21] border-gray-800 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
                  </Card>
                ) : (
                  <Card className="h-full bg-[#1a1d21] border-gray-800 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Code className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a file to preview</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a repository to browse files</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
