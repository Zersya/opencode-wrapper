"use client"

import * as React from "react"
import { Search, GitBranch, Lock, Globe, Star, ExternalLink, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Repository } from "@/lib/git/actions"

interface RepositoryBrowserProps {
  repositories: Repository[]
  onSelect?: (repo: Repository) => void
  selectedId?: string
  className?: string
  loading?: boolean
  onRefresh?: () => void
}

export function RepositoryBrowser({
  repositories,
  onSelect,
  selectedId,
  className,
  loading = false,
  onRefresh,
}: RepositoryBrowserProps) {
  const [search, setSearch] = React.useState("")

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

  return (
    <div className={cn("flex flex-col", className)}>
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

      {/* Repository List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? "No repositories found" : "No repositories available"}
          </div>
        ) : (
          filtered.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onSelect?.(repo)}
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
          ))
        )}
      </div>
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
