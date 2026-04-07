"use client"

import * as React from "react"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Plus, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TaskCard } from "./task-card"
import type { Task } from "@/lib/db/schema"

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  taskIds: number[]
  className?: string
  onAddTask?: () => void
}

const columnColors: Record<string, string> = {
  backlog: "text-gray-500",
  todo: "text-purple-400",
  "in-progress": "text-amber-400",
  "in-review": "text-blue-400",
  done: "text-green-400",
  canceled: "text-red-400",
}

export function KanbanColumn({
  id,
  title,
  tasks,
  taskIds,
  className,
  onAddTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const statusKey = id.replace(/-/g, "_")
  const colorClass = columnColors[id] || columnColors[statusKey] || "text-gray-500"

  return (
    <div className={cn("flex flex-col min-w-[280px] max-w-[280px] h-full", className)}>
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-sm font-medium", colorClass)}>
            {title}
          </h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-500 hover:text-white hover:bg-gray-800"
            onClick={onAddTask}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-gray-800"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-[#1a1d21] border-gray-800">
              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                Mark all as done
              </DropdownMenuItem>
              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                Copy column link
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400 focus:bg-gray-800 focus:text-red-400">
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 p-1 rounded-lg transition-colors min-h-[200px] overflow-y-auto scrollbar-custom",
          isOver && "bg-primary/10"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task as any} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <button
            onClick={onAddTask}
            className="w-full py-8 text-sm text-gray-500 hover:text-gray-400 hover:bg-gray-800/50 rounded-lg transition-colors border border-dashed border-gray-700"
          >
            Add task
          </button>
        )}
      </div>
    </div>
  )
}
