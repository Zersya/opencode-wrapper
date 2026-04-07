"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import {
  GripVertical,
  MessageSquare,
  Paperclip,
  Zap,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Task, User } from "@/lib/db/schema"

interface TaskCardProps {
  task: Task & {
    assignee?: User | null
    _count?: {
      comments?: number
      attachments?: number
    }
  }
  className?: string
}

const priorityConfig = {
  no_priority: { label: "No priority", color: "bg-gray-600" },
  low: { label: "Low", color: "bg-gray-500" },
  medium: { label: "Medium", color: "bg-blue-500" },
  high: { label: "High", color: "bg-amber-500" },
  urgent: { label: "Urgent", color: "bg-red-500" },
}

const statusColors = {
  backlog: "border-l-gray-500",
  todo: "border-l-purple-500",
  in_progress: "border-l-amber-500",
  in_review: "border-l-blue-500",
  done: "border-l-green-500",
  canceled: "border-l-red-500",
}

export function TaskCard({ task, className }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priority = priorityConfig[task.priority]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-[#1a1d21] border border-gray-800 rounded-lg border-l-2 overflow-hidden transition-all",
        statusColors[task.status],
        isDragging && "opacity-50 shadow-lg scale-105",
        className
      )}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="block p-3"
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-600" />
        </div>

        {/* Priority Indicator */}
        <div className="flex items-start gap-2 mb-2 ml-4">
          <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", priority.color)} />
          <span className="text-xs text-gray-500">OPN-{task.id}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 ml-4">
          {task.title}
        </h3>

        {/* Footer */}
        <div className="flex items-center justify-between ml-4 mt-3">
          <div className="flex items-center gap-3">
            {/* Comments */}
            {task._count?.comments && task._count.comments > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MessageSquare className="h-3 w-3" />
                {task._count.comments}
              </span>
            )}

            {/* Auto Execute Badge */}
            {task.autoExecute && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Zap className="h-3 w-3" />
              </span>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {/* Assignee */}
          {task.assignee && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.assignee.avatarUrl || ""} />
              <AvatarFallback className="text-[8px] bg-primary">
                {task.assignee.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </Link>
    </div>
  )
}
