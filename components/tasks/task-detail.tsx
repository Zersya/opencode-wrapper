"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Calendar,
  Zap,
  Play,
  MessageSquare,
  Activity,
  Clock,
  GitBranch,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Task } from "@/lib/db/schema"

interface TaskDetailProps {
  task: Task & {
    assignee?: { id: string; name: string; avatarUrl: string | null } | null
    creator?: { id: string; name: string; avatarUrl: string | null }
    project?: { id: number; name: string; slug: string }
    _count?: { comments: number; executions: number }
  }
  onClose?: () => void
}

const statusConfig = {
  backlog: { label: "Backlog", color: "bg-gray-500" },
  todo: { label: "Todo", color: "bg-purple-500" },
  in_progress: { label: "In Progress", color: "bg-amber-500" },
  in_review: { label: "In Review", color: "bg-blue-500" },
  done: { label: "Done", color: "bg-green-500" },
  canceled: { label: "Canceled", color: "bg-red-500" },
}

const priorityConfig = {
  no_priority: { label: "No priority", color: "bg-gray-600", textColor: "text-gray-400" },
  low: { label: "Low", color: "bg-gray-500", textColor: "text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-500", textColor: "text-blue-400" },
  high: { label: "High", color: "bg-amber-500", textColor: "text-amber-400" },
  urgent: { label: "Urgent", color: "bg-red-500", textColor: "text-red-400" },
}

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  const router = useRouter()
  const [editMode, setEditMode] = React.useState<"title" | "description" | null>(null)
  const [title, setTitle] = React.useState(task.title)
  const [description, setDescription] = React.useState(task.description || "")
  const [executeDialogOpen, setExecuteDialogOpen] = React.useState(false)

  const status = statusConfig[task.status]
  const priority = priorityConfig[task.priority]

  const handleSave = async () => {
    // TODO: Implement save
    setEditMode(null)
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className={cn("w-3 h-3 rounded-full", status.color)} />
            <span className="text-sm text-gray-400">OPN-{task.id}</span>
          </div>

          <div className="flex items-center gap-1">
            {task.opencodeCommand && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-gray-700 text-gray-300"
                onClick={() => setExecuteDialogOpen(true)}
              >
                <Play className="h-3 w-3" />
                Run
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#1a1d21] border-gray-800">
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  Copy task ID
                </DropdownMenuItem>
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  Copy task link
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  Duplicate task
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-400 focus:bg-gray-800 focus:text-red-400">
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={onClose}
              className="hidden lg:block p-1 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Title */}
            {editMode === "title" ? (
              <div className="mb-4">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-semibold bg-gray-800 border-gray-700"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <h1
                className="text-xl font-semibold text-white mb-4 cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 py-0.5"
                onClick={() => setEditMode("title")}
              >
                {task.title}
              </h1>
            )}

            {/* Description */}
            {editMode === "description" ? (
              <div className="mb-6">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[200px] bg-gray-800 border-gray-700"
                  placeholder="Add a description..."
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-gray-400 mb-6 cursor-pointer hover:bg-gray-800/50 rounded px-2 -mx-2 py-2 min-h-[80px]"
                onClick={() => setEditMode("description")}
              >
                {task.description || "Add a description..."}
              </div>
            )}

            {/* Properties */}
            <div className="space-y-3 mb-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Status</div>
                <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                  <div className={cn("w-3 h-3 rounded-full", status.color)} />
                  <span className="text-sm text-white">{status.label}</span>
                </button>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Priority</div>
                <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                  <div className={cn("w-3 h-3 rounded-sm", priority.color)} />
                  <span className={cn("text-sm", priority.textColor)}>{priority.label}</span>
                </button>
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Assignee</div>
                <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                  {task.assignee ? (
                    <>
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={task.assignee.avatarUrl || ""} />
                        <AvatarFallback className="text-[8px] bg-primary">
                          {task.assignee.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-white">{task.assignee.name}</span>
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-400">Unassigned</span>
                    </>
                  )}
                </button>
              </div>

              {/* Project */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Project</div>
                <Link
                  href={`/projects/${task.project?.slug}`}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                >
                  <GitBranch className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-white">{task.project?.name}</span>
                </Link>
              </div>

              {/* Due Date */}
              {task.dueDate && (
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-500">Due</div>
                  <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-white">
                      {new Date(task.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </button>
                </div>
              )}

              {/* Auto Execute */}
              {task.autoExecute && (
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-500">Auto Run</div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-amber-400">Enabled</span>
                  </div>
                </div>
              )}

              {/* OpenCode Command */}
              {task.opencodeCommand && (
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-500">Command</div>
                  <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded font-mono">
                    opencode {task.opencodeCommand}
                  </code>
                </div>
              )}
            </div>

            <Separator className="bg-gray-800 my-6" />

            {/* Activity Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">Activity</h3>

              {/* Quick Comment */}
              <div className="flex gap-3">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[8px] bg-primary">JD</AvatarFallback>
                </Avatar>
                <Input
                  placeholder="Leave a comment..."
                  className="flex-1 bg-gray-800 border-gray-700 text-sm"
                />
              </div>

              {/* Activity List */}
              <div className="space-y-4 pt-4">
                <div className="flex gap-3 text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[8px] bg-primary">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-gray-300">
                      <span className="font-medium text-white">John</span>{" "}
                      created this task
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">2 hours ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
            <Activity className="h-4 w-4" />
            Activity
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
            <MessageSquare className="h-4 w-4" />
            Comments
          </Button>
        </div>
      </div>

      {/* Execute Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="bg-[#1a1d21] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Execute OpenCode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-400">
              This will run the following command in the project workspace:
            </p>
            <code className="block p-3 bg-gray-800 rounded text-sm font-mono text-gray-300">
              opencode {task.opencodeCommand}
            </code>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExecuteDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-primary hover:bg-primary/90">
                <Play className="h-4 w-4 mr-2" />
                Execute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
