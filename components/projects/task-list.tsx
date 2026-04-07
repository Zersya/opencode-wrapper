"use client"

import * as React from "react"
import Link from "next/link"
import { User, Calendar, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Task } from "@/lib/db/schema"

interface TaskListProps {
  tasks: Task[]
  projectId: number
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

export function TaskList({ tasks, projectId }: TaskListProps) {
  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }
      return b.id - a.id
    })
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <p className="text-gray-400">No tasks yet</p>
        <p className="text-sm text-gray-500 mt-1">Create your first task to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 text-sm font-medium text-gray-400 border-b border-gray-800">
        <div className="w-8">ID</div>
        <div>Task</div>
        <div className="w-24">Status</div>
        <div className="w-24">Priority</div>
        <div className="w-32">Assignee</div>
        <div className="w-32">Due Date</div>
        <div className="w-10"></div>
      </div>

      {sortedTasks.map((task) => {
        const status = statusConfig[task.status]
        const priority = priorityConfig[task.priority]

        return (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 text-sm hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 group"
          >
            <div className="w-8 text-gray-500 font-mono">OPN-{task.id}</div>
            <div className="text-white truncate">{task.title}</div>
            <div className="w-24">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", status.color)} />
                <span className="text-gray-300 truncate">{status.label}</span>
              </div>
            </div>
            <div className="w-24">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-sm", priority.color)} />
                <span className={cn("truncate", priority.textColor)}>{priority.label}</span>
              </div>
            </div>
            <div className="w-32">
              {task.assigneeId ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary">JD</AvatarFallback>
                  </Avatar>
                  <span className="text-gray-300 truncate">User</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <User className="h-4 w-4" />
                  <span className="truncate">Unassigned</span>
                </div>
              )}
            </div>
            <div className="w-32">
              {task.dueDate ? (
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="truncate">
                    {new Date(task.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </div>
            <div className="w-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#1a1d21] border-gray-800">
                  <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                    Edit Task
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400 focus:bg-gray-800 focus:text-red-400">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
