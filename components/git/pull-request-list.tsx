"use client"

import * as React from "react"
import Link from "next/link"
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  MessageSquare,
  Calendar,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { PullRequest } from "@/lib/git/actions"

interface PullRequestListProps {
  pullRequests: PullRequest[]
  className?: string
}

const statusConfig = {
  open: {
    icon: GitPullRequest,
    color: "text-green-400",
    bgColor: "bg-green-400",
  },
  closed: {
    icon: GitPullRequestClosed,
    color: "text-red-400",
    bgColor: "bg-red-400",
  },
  merged: {
    icon: GitMerge,
    color: "text-purple-400",
    bgColor: "bg-purple-400",
  },
}

export function PullRequestList({ pullRequests, className }: PullRequestListProps) {
  if (pullRequests.length === 0) {
    return (
      <div className={cn("text-center py-8 text-gray-500", className)}>
        No pull requests found
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {pullRequests.map((pr) => {
        const status = statusConfig[pr.state]
        const StatusIcon = status.icon

        return (
          <a
            key={pr.id}
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-4 rounded-lg bg-[#1a1d21] border border-gray-800 hover:bg-gray-800/50 transition-colors group"
          >
            {/* Status Icon */}
            <div className="flex-shrink-0 mt-1">
              <StatusIcon className={cn("h-5 w-5", status.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">
                    {pr.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>#{pr.number}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={pr.author.avatarUrl} />
                        <AvatarFallback className="text-[8px]">
                          {pr.author.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      {pr.author.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {pr.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>

              {/* Branch Info */}
              <div className="flex items-center gap-2 mt-2 text-xs">
                <Badge variant="secondary" className="bg-gray-800 text-gray-400">
                  {pr.sourceBranch}
                </Badge>
                <span className="text-gray-600">→</span>
                <Badge variant="secondary" className="bg-gray-800 text-gray-400">
                  {pr.targetBranch}
                </Badge>
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}
