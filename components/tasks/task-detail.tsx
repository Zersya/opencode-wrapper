"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  X,
  ChevronLeft,
  MoreHorizontal,
  User,
  Calendar,
  Zap,
  Play,
  MessageSquare,
  Activity,
  Clock,
  GitBranch,
  Loader2,
  Check,
  Trash2,
  Pencil,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Sparkles,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { executeTask } from "@/lib/actions/executions"
import { 
  updateTask, 
  deleteTask, 
  updateTaskStatus, 
  updateTaskPriority, 
  updateTaskAssignee,
  updateTaskDueDate,
} from "@/lib/actions/tasks"
import { createComment, deleteComment, updateComment, type CommentWithUser } from "@/lib/actions/comments"
import { type ActivityItem, recordOpencodeCommandChange } from "@/lib/actions/activity"
import { generateOpencodeCommand } from "@/lib/actions/command-generator"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import type { Task } from "@/lib/db/schema"

interface TaskDetailProps {
  task: Task & {
    assignee?: { id: string; name: string; avatarUrl: string | null } | null
    creator?: { id: string; name: string; avatarUrl: string | null }
    project?: { id: number; name: string; slug: string; organizationId: number }
    _count?: { comments: number; executions: number }
  }
  initialComments: CommentWithUser[]
  initialActivities: ActivityItem[]
  organizationMembers: Array<{
    id: number
    role: string
    joinedAt: Date | null
    user: {
      id: string
      name: string
      email: string
      avatarUrl: string | null
    }
  }>
  onClose?: () => void
}

const statusConfig = {
  backlog: { label: "Backlog", color: "bg-gray-500", icon: MinusCircle },
  todo: { label: "Todo", color: "bg-purple-500", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-500", icon: ArrowUpCircle },
  in_review: { label: "In Review", color: "bg-blue-500", icon: CheckCircle2 },
  done: { label: "Done", color: "bg-green-500", icon: CheckCircle2 },
  canceled: { label: "Canceled", color: "bg-red-500", icon: AlertCircle },
}

const priorityConfig = {
  no_priority: { label: "No priority", color: "bg-gray-600", textColor: "text-gray-400", icon: MinusCircle },
  low: { label: "Low", color: "bg-gray-500", textColor: "text-gray-400", icon: ArrowDownCircle },
  medium: { label: "Medium", color: "bg-blue-500", textColor: "text-blue-400", icon: ArrowUpCircle },
  high: { label: "High", color: "bg-amber-500", textColor: "text-amber-400", icon: ArrowUpCircle },
  urgent: { label: "Urgent", color: "bg-red-500", textColor: "text-red-400", icon: AlertCircle },
}

type EditMode = "title" | "description" | "opencodeCommand" | "none"
type Tab = "comments" | "activity"

export function TaskDetail({ 
  task, 
  initialComments, 
  initialActivities, 
  organizationMembers,
  onClose 
}: TaskDetailProps) {
  const router = useRouter()
  const [editMode, setEditMode] = React.useState<EditMode>("none")
  const [title, setTitle] = React.useState(task.title)
  const [description, setDescription] = React.useState(task.description || "")
  const [opencodeCommand, setOpencodeCommand] = React.useState(task.opencodeCommand || "")
  const [autoExecute, setAutoExecute] = React.useState(task.autoExecute || false)
  const [executeDialogOpen, setExecuteDialogOpen] = React.useState(false)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isGeneratingCommand, setIsGeneratingCommand] = React.useState(false)
  const [generatedExplanation, setGeneratedExplanation] = React.useState<string | null>(null)
  
  // Comments state
  const [comments, setComments] = React.useState<CommentWithUser[]>(initialComments)
  const [newComment, setNewComment] = React.useState("")
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false)
  const [editingCommentId, setEditingCommentId] = React.useState<number | null>(null)
  const [editingCommentContent, setEditingCommentContent] = React.useState("")
  
  // Activity state
  const [activities] = React.useState<ActivityItem[]>(initialActivities)
  const [activeTab, setActiveTab] = React.useState<Tab>("comments")

  const status = statusConfig[task.status]
  const priority = priorityConfig[task.priority]
  const StatusIcon = status.icon
  const PriorityIcon = priority.icon

  const handleSaveTitle = async () => {
    if (!title.trim() || title === task.title) {
      setEditMode("none")
      return
    }
    
    setIsSaving(true)
    try {
      await updateTask({ id: task.id, title: title.trim() })
      toast.success("Title updated")
      setEditMode("none")
    } catch (error) {
      toast.error("Failed to update title", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
      setTitle(task.title)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDescription = async () => {
    if (description === (task.description || "")) {
      setEditMode("none")
      return
    }
    
    setIsSaving(true)
    try {
      await updateTask({ id: task.id, description: description.trim() || undefined })
      toast.success("Description updated")
      setEditMode("none")
    } catch (error) {
      toast.error("Failed to update description", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
      setDescription(task.description || "")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveOpencodeCommand = async () => {
    const trimmedCommand = opencodeCommand.trim()
    const currentCommand = task.opencodeCommand || ""
    
    if (trimmedCommand === currentCommand) {
      setEditMode("none")
      return
    }
    
    setIsSaving(true)
    try {
      await updateTask({ 
        id: task.id, 
        opencodeCommand: trimmedCommand || null,
        autoExecute: trimmedCommand ? autoExecute : false 
      })
      
      // Record activity
      await recordOpencodeCommandChange(task.id, task.opencodeCommand || null, trimmedCommand || null)
      
      toast.success("OpenCode command updated")
      setEditMode("none")
    } catch (error) {
      toast.error("Failed to update command", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
      setOpencodeCommand(task.opencodeCommand || "")
      setAutoExecute(task.autoExecute || false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAutoExecuteChange = async (newAutoExecute: boolean) => {
    if (!opencodeCommand.trim()) {
      toast.error("Cannot enable auto-execute without a command")
      return
    }
    
    setAutoExecute(newAutoExecute)
    try {
      await updateTask({ id: task.id, autoExecute: newAutoExecute })
      toast.success(newAutoExecute ? "Auto-execute enabled" : "Auto-execute disabled")
    } catch (error) {
      toast.error("Failed to update auto-execute", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
      setAutoExecute(task.autoExecute || false)
    }
  }

  const handleGenerateCommand = async () => {
    setIsGeneratingCommand(true)
    setGeneratedExplanation(null)
    
    try {
      const result = await generateOpencodeCommand(task.id)
      
      // Set the generated command
      setOpencodeCommand(result.command)
      setAutoExecute(result.autoExecute)
      setGeneratedExplanation(result.explanation)
      
      // Switch to edit mode so user can review and save
      setEditMode("opencodeCommand")
      
      toast.success("Command generated!", {
        description: result.explanation,
      })
    } catch (error) {
      toast.error("Failed to generate command", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    } finally {
      setIsGeneratingCommand(false)
    }
  }

  const handleStatusChange = async (newStatus: Task["status"]) => {
    if (newStatus === task.status) return
    
    try {
      await updateTaskStatus(task.id, newStatus)
      toast.success(`Status changed to ${statusConfig[newStatus].label}`)
    } catch (error) {
      toast.error("Failed to update status", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const handlePriorityChange = async (newPriority: Task["priority"]) => {
    if (newPriority === task.priority) return
    
    try {
      await updateTaskPriority(task.id, newPriority)
      toast.success(`Priority changed to ${priorityConfig[newPriority].label}`)
    } catch (error) {
      toast.error("Failed to update priority", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string | null, assigneeName?: string) => {
    if (newAssigneeId === task.assignee?.id) return
    
    try {
      await updateTaskAssignee(task.id, newAssigneeId, assigneeName)
      if (newAssigneeId) {
        toast.success(`Assigned to ${assigneeName || "user"}`)
      } else {
        toast.success("Unassigned")
      }
    } catch (error) {
      toast.error("Failed to update assignee", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const handleDueDateChange = async (date: Date | undefined) => {
    try {
      await updateTaskDueDate(task.id, date ? date.toISOString() : undefined)
      if (date) {
        toast.success("Due date set")
      } else {
        toast.success("Due date removed")
      }
    } catch (error) {
      toast.error("Failed to update due date", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteTask(task.id)
      toast.success("Task deleted")
      router.push(`/projects/${task.project?.slug || task.projectId}`)
    } catch (error) {
      toast.error("Failed to delete task", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleExecute = async () => {
    if (!opencodeCommand.trim()) return

    setIsExecuting(true)
    try {
      const execution = await executeTask(task.id)
      toast.success("Execution started")
      setExecuteDialogOpen(false)
      router.push(`/executions/${execution.id}`)
    } catch (error) {
      toast.error("Failed to start execution", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    } finally {
      setIsExecuting(false)
    }
  }

  // Comment handlers
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return
    
    setIsSubmittingComment(true)
    try {
      const comment = await createComment({
        taskId: task.id,
        content: newComment.trim(),
      })
      setComments([comment, ...comments])
      setNewComment("")
      toast.success("Comment added")
    } catch (error) {
      toast.error("Failed to add comment", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment({ commentId })
      setComments(comments.filter((c) => c.id !== commentId))
      toast.success("Comment deleted")
    } catch (error) {
      toast.error("Failed to delete comment", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const handleEditComment = async (commentId: number) => {
    if (!editingCommentContent.trim()) return
    
    try {
      const updated = await updateComment(commentId, editingCommentContent.trim())
      setComments(comments.map((c) => (c.id === commentId ? updated : c)))
      setEditingCommentId(null)
      setEditingCommentContent("")
      toast.success("Comment updated")
    } catch (error) {
      toast.error("Failed to update comment", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    }
  }

  const startEditComment = (comment: CommentWithUser) => {
    setEditingCommentId(comment.id)
    setEditingCommentContent(comment.content)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentContent("")
  }

  // Get combined activity feed (activities + comments)
  const activityFeed: ActivityItem[] = React.useMemo(() => {
    const commentActivities: ActivityItem[] = comments.map((c) => ({
      id: c.id,
      type: "comment" as const,
      content: c.content,
      createdAt: c.createdAt,
      user: c.user,
    }))
    
    return [...activities, ...commentActivities].sort((a, b) => {
      const dateA = a.createdAt || new Date(0)
      const dateB = b.createdAt || new Date(0)
      return dateB.getTime() - dateA.getTime()
    })
  }, [activities, comments])

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
            {opencodeCommand && (
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
                <DropdownMenuItem 
                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                  onClick={() => navigator.clipboard.writeText(`OPN-${task.id}`)}
                >
                  Copy task ID
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/tasks/${task.id}`)}
                >
                  Copy task link
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  Duplicate task
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-400 focus:bg-gray-800 focus:text-red-400"
                  onClick={() => setDeleteDialogOpen(true)}
                >
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSaveTitle()
                    }
                    if (e.key === "Escape") {
                      setEditMode("none")
                      setTitle(task.title)
                    }
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSaveTitle} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditMode("none")
                    setTitle(task.title)
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <h1
                className="text-xl font-semibold text-white mb-4 cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 py-0.5 transition-colors"
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
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditMode("none")
                      setDescription(task.description || "")
                    }
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSaveDescription} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditMode("none")
                    setDescription(task.description || "")
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-gray-400 mb-6 cursor-pointer hover:bg-gray-800/50 rounded px-2 -mx-2 py-2 min-h-[80px] transition-colors"
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                      <StatusIcon className={cn("h-4 w-4", status.color.replace("bg-", "text-"))} />
                      <span className="text-sm text-white">{status.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-[#1a1d21] border-gray-800">
                    <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => handleStatusChange(v as Task["status"])}>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <DropdownMenuRadioItem 
                          key={key} 
                          value={key}
                          className="text-gray-300 focus:bg-gray-800 focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", config.color)} />
                            {config.label}
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Priority</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                      <PriorityIcon className={cn("h-4 w-4", priority.textColor)} />
                      <span className={cn("text-sm", priority.textColor)}>{priority.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-[#1a1d21] border-gray-800">
                    <DropdownMenuRadioGroup value={task.priority} onValueChange={(v) => handlePriorityChange(v as Task["priority"])}>
                      {Object.entries(priorityConfig).map(([key, config]) => (
                        <DropdownMenuRadioItem 
                          key={key} 
                          value={key}
                          className="text-gray-300 focus:bg-gray-800 focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-sm", config.color)} />
                            {config.label}
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Assignee</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
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
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-[#1a1d21] border-gray-800">
                    <DropdownMenuItem 
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                      onClick={() => handleAssigneeChange(null)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Unassigned
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-800" />
                    {organizationMembers.map((member) => (
                      <DropdownMenuItem 
                        key={member.user.id}
                        className="text-gray-300 focus:bg-gray-800 focus:text-white"
                        onClick={() => handleAssigneeChange(member.user.id, member.user.name)}
                      >
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={member.user.avatarUrl || ""} />
                          <AvatarFallback className="text-[8px] bg-primary">
                            {member.user.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        {member.user.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Due</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleDueDateChange(e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-auto bg-gray-800 border-gray-700 text-sm"
                  />
                  {task.dueDate && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400"
                      onClick={() => handleDueDateChange(undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Auto Execute - Always visible with toggle */}
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-500">Auto Run</div>
                <button
                  onClick={() => handleAutoExecuteChange(!autoExecute)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded transition-colors",
                    opencodeCommand.trim() ? "hover:bg-gray-800 cursor-pointer" : "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!opencodeCommand.trim()}
                >
                  <Zap className={cn("h-4 w-4", autoExecute ? "text-amber-400" : "text-gray-500")} />
                  <span className={cn("text-sm", autoExecute ? "text-amber-400" : "text-gray-400")}>
                    {autoExecute ? "Enabled" : "Disabled"}
                  </span>
                </button>
              </div>

              {/* OpenCode Command - Editable */}
              {editMode === "opencodeCommand" ? (
                <div className="flex items-start gap-3">
                  <div className="w-24 text-sm text-gray-500 pt-2">Command</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 font-mono">opencode</span>
                      <Input
                        value={opencodeCommand}
                        onChange={(e) => setOpencodeCommand(e.target.value)}
                        placeholder="e.g., /fix bugs or /review"
                        className="flex-1 bg-gray-800 border-gray-700 font-mono text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSaveOpencodeCommand()
                          }
                          if (e.key === "Escape") {
                            setEditMode("none")
                            setOpencodeCommand(task.opencodeCommand || "")
                            setAutoExecute(task.autoExecute || false)
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveOpencodeCommand} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setEditMode("none")
                          setOpencodeCommand(task.opencodeCommand || "")
                          setAutoExecute(task.autoExecute || false)
                          setGeneratedExplanation(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    {/* AI Explanation */}
                    {generatedExplanation && (
                      <div className="flex items-start gap-2 p-2 bg-primary/5 border border-primary/20 rounded">
                        <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-primary">{generatedExplanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-500">Command</div>
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className="flex-1 cursor-pointer hover:bg-gray-800/50 rounded px-2 -mx-2 py-1 transition-colors group"
                      onClick={() => setEditMode("opencodeCommand")}
                    >
                      {opencodeCommand ? (
                        <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded font-mono">
                          opencode {opencodeCommand}
                        </code>
                      ) : (
                        <span className="text-sm text-gray-500 italic">Click to add OpenCode command...</span>
                      )}
                    </div>
                    
                    {/* Generate Button - Show when no command or as enhancement */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10 border border-primary/20"
                      onClick={handleGenerateCommand}
                      disabled={isGeneratingCommand}
                    >
                      {isGeneratingCommand ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {isGeneratingCommand ? "Thinking..." : "AI Generate"}
                    </Button>
                    
                    <Pencil 
                      className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" 
                      onClick={() => setEditMode("opencodeCommand")}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-gray-800 my-6" />

            {/* Activity/Comments Section */}
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex items-center gap-4 border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("comments")}
                  className={cn(
                    "flex items-center gap-2 px-1 pb-2 text-sm font-medium transition-colors",
                    activeTab === "comments" 
                      ? "text-white border-b-2 border-primary" 
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Comments
                  {comments.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-gray-800">
                      {comments.length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("activity")}
                  className={cn(
                    "flex items-center gap-2 px-1 pb-2 text-sm font-medium transition-colors",
                    activeTab === "activity" 
                      ? "text-white border-b-2 border-primary" 
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Activity className="h-4 w-4" />
                  Activity
                </button>
              </div>

              {/* Comments Tab */}
              {activeTab === "comments" && (
                <>
                  {/* New Comment Input */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary">ME</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Leave a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px] bg-gray-800 border-gray-700 text-sm resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.metaKey) {
                            handleSubmitComment()
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim() || isSubmittingComment}
                        >
                          {isSubmittingComment ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Comment
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">Be the first to comment</p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.user.avatarUrl || ""} />
                            <AvatarFallback className="text-xs bg-primary">
                              {comment.user.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {comment.user.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {comment.createdAt && formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                              </span>
                              {comment.updatedAt && comment.updatedAt.getTime() !== (comment.createdAt?.getTime() || 0) && (
                                <span className="text-xs text-gray-500">(edited)</span>
                              )}
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  className="min-h-[80px] bg-gray-800 border-gray-700 text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleEditComment(comment.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={cancelEditComment}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-300 mt-1">{comment.content}</p>
                            )}
                          </div>
                          
                          {/* Comment Actions */}
                          {editingCommentId !== comment.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32 bg-[#1a1d21] border-gray-800">
                                <DropdownMenuItem 
                                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                                  onClick={() => startEditComment(comment)}
                                >
                                  <Pencil className="h-3 w-3 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-400 focus:bg-gray-800 focus:text-red-400"
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* Activity Tab */}
              {activeTab === "activity" && (
                <div className="space-y-4">
                  {activityFeed.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activity yet</p>
                    </div>
                  ) : (
                    activityFeed.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.user.avatarUrl || ""} />
                          <AvatarFallback className="text-xs bg-primary">
                            {item.user.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm text-gray-300">
                            {item.type === "comment" ? (
                              <>
                                <span className="font-medium text-white">{item.user.name}</span>
                                {" commented"}
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-white">{item.user.name}</span>
                                {" "}
                                {(() => {
                                  const activity = item as typeof item & { 
                                    type: string
                                    oldValue: string | null
                                    newValue: string | null
                                    metadata: Record<string, unknown> | null
                                  }
                                  switch (activity.type) {
                                    case "status_change":
                                      return `changed status from "${activity.oldValue}" to "${activity.newValue}"`
                                    case "priority_change":
                                      return `changed priority from "${activity.oldValue}" to "${activity.newValue}"`
                                    case "assignee_change":
                                      if (!activity.oldValue && activity.newValue) {
                                        const name = (activity.metadata as { assigneeName?: string })?.assigneeName || activity.newValue
                                        return `assigned to ${name}`
                                      } else if (activity.oldValue && !activity.newValue) {
                                        return `unassigned`
                                      } else {
                                        const name = (activity.metadata as { assigneeName?: string })?.assigneeName || activity.newValue
                                        return `reassigned to ${name}`
                                      }
                                    case "title_change":
                                      return `updated the title`
                                    case "description_change":
                                      return `updated the description`
                                    case "opencode_command_change":
                                      if (!activity.oldValue && activity.newValue) {
                                        return `added OpenCode command`
                                      } else if (activity.oldValue && !activity.newValue) {
                                        return `removed OpenCode command`
                                      } else {
                                        return `updated OpenCode command`
                                      }
                                    case "execution_started":
                                      return `started an execution`
                                    case "task_created":
                                      return `created this task`
                                    default:
                                      return `performed an action`
                                  }
                                })()}
                              </>
                            )}
                          </p>
                          {item.type === "comment" && (
                            <p className="text-sm text-gray-400 mt-1 bg-gray-800/50 rounded p-2">
                              {(item as CommentWithUser & { type: "comment" }).content}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {item.createdAt && formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
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
              opencode {opencodeCommand}
            </code>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExecuteDialogOpen(false)} disabled={isExecuting}>
                Cancel
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90"
                onClick={handleExecute}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isExecuting ? "Starting..." : "Execute"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#1a1d21] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
