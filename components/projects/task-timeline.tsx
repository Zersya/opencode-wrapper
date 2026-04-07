"use client"

import * as React from "react"
import Link from "next/link"
import { Calendar, User, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Task } from "@/lib/db/schema"

interface TaskTimelineProps {
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
  no_priority: { label: "No priority", color: "bg-gray-600", textColor: "text-gray-400", dotColor: "bg-gray-500" },
  low: { label: "Low", color: "bg-gray-500", textColor: "text-gray-400", dotColor: "bg-gray-500" },
  medium: { label: "Medium", color: "bg-blue-500", textColor: "text-blue-400", dotColor: "bg-blue-500" },
  high: { label: "High", color: "bg-amber-500", textColor: "text-amber-400", dotColor: "bg-amber-500" },
  urgent: { label: "Urgent", color: "bg-red-500", textColor: "text-red-400", dotColor: "bg-red-500" },
}

interface GroupedTasks {
  [key: string]: Task[]
}

export function TaskTimeline({ tasks, projectId }: TaskTimelineProps) {
  const { groupedByDate, tasksWithoutDueDate } = React.useMemo(() => {
    const withDueDate = tasks.filter((task) => task.dueDate !== null)
    const withoutDueDate = tasks.filter((task) => task.dueDate === null)

    const grouped = withDueDate.reduce<GroupedTasks>((acc, task) => {
      const date = new Date(task.dueDate!)
      const key = date.toISOString().split("T")[0]
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(task)
      return acc
    }, {})

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, no_priority: 4 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
    })

    return { groupedByDate: grouped, tasksWithoutDueDate: withoutDueDate }
  }, [tasks])

  const sortedDates = React.useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [groupedByDate])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const taskDate = new Date(dateString)
    taskDate.setHours(0, 0, 0, 0)

    if (taskDate.getTime() === today.getTime()) {
      return "Today"
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      return "Tomorrow"
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    }
  }

  const isOverdue = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date < today
  }

  const isToday = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <Calendar className="h-12 w-12 text-gray-500 mb-4" />
        <p className="text-gray-400">No tasks yet</p>
        <p className="text-sm text-gray-500 mt-1">Create your first task to see it on the timeline</p>
      </div>
    )
  }

  return (
    <div className="flex gap-8 h-full">
      <div className="flex-1 overflow-auto scrollbar-custom">
        <div className="space-y-8">
          {sortedDates.map((date) => {
            const tasksForDate = groupedByDate[date]
            const overdue = isOverdue(date) && tasksForDate.some((t) => t.status !== "done")
            const today = isToday(date)

            return (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3 sticky top-0 bg-[#0f1115] py-2 z-10">
                  <div
                    className={cn(
                      "h-px flex-1",
                      overdue ? "bg-red-500/30" : today ? "bg-primary/30" : "bg-gray-800"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    {overdue && <Clock className="h-4 w-4 text-red-400" />}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        overdue ? "text-red-400" : today ? "text-primary" : "text-gray-300"
                      )}
                    >
                      {formatDate(date)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-px flex-1",
                      overdue ? "bg-red-500/30" : today ? "bg-primary/30" : "bg-gray-800"
                    )}
                  />
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      overdue ? "bg-red-500/10 text-red-300" : "bg-gray-800 text-gray-400"
                    )}
                  >
                    {tasksForDate.length}
                  </Badge>
                </div>

                <div className="space-y-2 pl-4">
                  {tasksForDate.map((task) => {
                    const status = statusConfig[task.status]
                    const priority = priorityConfig[task.priority]

                    return (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-gray-800/50",
                          overdue && task.status !== "done"
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-gray-800 bg-gray-800/20"
                        )}
                      >
                        <div className="flex flex-col items-center gap-2 pt-1">
                          <div className={cn("w-3 h-3 rounded-full", status.color)} />
                          <div className="w-px h-full bg-gray-800" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-gray-500 font-mono text-xs">OPN-{task.id}</span>
                              <h3 className="text-white truncate">{task.title}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-sm", priority.dotColor)} />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-400">{status.label}</span>
                            {task.assigneeId && (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[6px] bg-primary">JD</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-400">User</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {tasksWithoutDueDate.length > 0 && (
        <div className="w-80 border-l border-gray-800 pl-6 overflow-auto scrollbar-custom">
          <div className="sticky top-0 bg-[#0f1115] py-2 z-10 mb-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">No Due Date</span>
              <Badge variant="secondary" className="text-xs bg-gray-800 text-gray-400">
                {tasksWithoutDueDate.length}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            {tasksWithoutDueDate.map((task) => {
              const status = statusConfig[task.status]
              const priority = priorityConfig[task.priority]

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-800 bg-gray-800/20 transition-all hover:bg-gray-800/50"
                >
                  <div className={cn("w-3 h-3 rounded-full mt-1", status.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-500 font-mono text-xs">OPN-{task.id}</span>
                    </div>
                    <h3 className="text-white text-sm truncate mb-1">{task.title}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{status.label}</span>
                      <div className={cn("w-1.5 h-1.5 rounded-sm", priority.dotColor)} />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
