"use client"

import * as React from "react"
import { Plus, Settings, GitBranch, Users, Edit, Archive, MoreHorizontal, Copy, Trash, Filter, ChevronDown, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { KanbanBoard } from "@/components/kanban"
import { CreateTaskForm } from "@/components/tasks"
import { TaskList, TaskTimeline, EditProjectDialog, DeleteProjectDialog, ArchiveProjectDialog } from "@/components/projects"
import { moveTask } from "@/lib/actions/tasks"
import type { Task, Project } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

interface ProjectWithTasks extends Project {
  tasks: Task[]
}

interface ProjectClientProps {
  project: ProjectWithTasks
}

type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled"
type TaskPriority = "no_priority" | "low" | "medium" | "high" | "urgent"

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: "backlog", label: "Backlog", color: "bg-gray-500" },
  { value: "todo", label: "Todo", color: "bg-purple-500" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { value: "in_review", label: "In Review", color: "bg-blue-500" },
  { value: "done", label: "Done", color: "bg-green-500" },
  { value: "canceled", label: "Canceled", color: "bg-red-500" },
]

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "no_priority", label: "No priority", color: "bg-gray-500" },
  { value: "low", label: "Low", color: "bg-gray-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-amber-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
]

const dueDateOptions = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "no_date", label: "No due date" },
]

export function ProjectClient({ project }: ProjectClientProps) {
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority[]>([])
  const [dueDateFilter, setDueDateFilter] = React.useState<string[]>([])

  const handleTaskMove = async (taskId: number, newStatus: string) => {
    await moveTask(taskId, newStatus)
  }

  const handleAddTask = (status: string) => {
    console.log(`Add task with status ${status}`)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  }

  const isThisWeek = (date: Date) => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    return date >= startOfWeek && date <= endOfWeek
  }

  const isThisMonth = (date: Date) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return date >= startOfMonth && date <= endOfMonth
  }

  const isOverdue = (date: Date, status: TaskStatus) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date < today && status !== "done" && status !== "canceled"
  }

  const matchesDueDateFilter = (task: Task) => {
    if (dueDateFilter.length === 0) return true

    return dueDateFilter.some((filter) => {
      if (filter === "no_date") {
        return task.dueDate === null
      }

      if (!task.dueDate) return false

      const taskDate = new Date(task.dueDate)

      switch (filter) {
        case "overdue":
          return isOverdue(taskDate, task.status)
        case "today":
          return isToday(taskDate)
        case "tomorrow":
          return isTomorrow(taskDate)
        case "this_week":
          return isThisWeek(taskDate)
        case "this_month":
          return isThisMonth(taskDate)
        default:
          return true
      }
    })
  }

  const filteredTasks = React.useMemo(() => {
    return project.tasks.filter((task) => {
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(task.status)
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(task.priority)
      const matchesDueDate = matchesDueDateFilter(task)

      return matchesStatus && matchesPriority && matchesDueDate
    })
  }, [project.tasks, statusFilter, priorityFilter, dueDateFilter])

  const toggleStatus = (status: TaskStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const togglePriority = (priority: TaskPriority) => {
    setPriorityFilter((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    )
  }

  const toggleDueDate = (dueDate: string) => {
    setDueDateFilter((prev) =>
      prev.includes(dueDate) ? prev.filter((d) => d !== dueDate) : [...prev, dueDate]
    )
  }

  const clearFilters = () => {
    setStatusFilter([])
    setPriorityFilter([])
    setDueDateFilter([])
  }

  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0 || dueDateFilter.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{project.name}</h1>
            <p className="text-sm text-gray-500">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-gray-800 text-gray-300">
            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
          </Badge>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-gray-400 hover:text-white",
                  statusFilter.length > 0 && "text-primary bg-primary/10"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Status
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 bg-primary/20 text-primary text-xs">
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[#1a1d21] border-gray-800">
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                  onClick={() => toggleStatus(option.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn("w-3 h-3 rounded-full", option.color)} />
                    <span className="flex-1">{option.label}</span>
                    {statusFilter.includes(option.value) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-gray-400 hover:text-white",
                  priorityFilter.length > 0 && "text-primary bg-primary/10"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Priority
                {priorityFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 bg-primary/20 text-primary text-xs">
                    {priorityFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[#1a1d21] border-gray-800">
              {priorityOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                  onClick={() => togglePriority(option.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn("w-3 h-3 rounded-sm", option.color)} />
                    <span className="flex-1">{option.label}</span>
                    {priorityFilter.includes(option.value) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-gray-400 hover:text-white",
                  dueDateFilter.length > 0 && "text-primary bg-primary/10"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Due Date
                {dueDateFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 bg-primary/20 text-primary text-xs">
                    {dueDateFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[#1a1d21] border-gray-800">
              {dueDateOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="text-gray-300 focus:bg-gray-800 focus:text-white"
                  onClick={() => toggleDueDate(option.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="flex-1">{option.label}</span>
                    {dueDateFilter.includes(option.value) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-gray-400 hover:text-white"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />
              Clear Filters
            </Button>
          )}

          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <Users className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1a1d21] border-gray-800">
              <EditProjectDialog 
                project={project} 
                trigger={
                  <DropdownMenuItem 
                    className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Project
                  </DropdownMenuItem>
                } 
              />
              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                <Users className="mr-2 h-4 w-4" />
                Manage Members
              </DropdownMenuItem>
              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                <Copy className="mr-2 h-4 w-4" />
                Copy Project
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <ArchiveProjectDialog 
                project={project} 
                trigger={
                  <DropdownMenuItem 
                    className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {project.status === "archived" ? "Restore Project" : "Archive Project"}
                  </DropdownMenuItem>
                } 
              />
              <DeleteProjectDialog 
                project={project} 
                trigger={
                  <DropdownMenuItem 
                    className="text-red-400 focus:bg-gray-800 focus:text-red-400 cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete Project
                  </DropdownMenuItem>
                } 
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <CreateTaskForm projectId={project.id} />
        </div>
      </div>

      <Tabs defaultValue="board" className="flex-1 flex flex-col">
        <div className="px-6 border-b border-gray-800">
          <TabsList className="bg-transparent border-b-0">
            <TabsTrigger
              value="board"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              Board
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              List
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="board" className="flex-1 p-6 m-0 overflow-hidden">
          <KanbanBoard
            tasks={filteredTasks}
            projectId={project.id}
            onTaskMove={handleTaskMove}
            onAddTask={handleAddTask}
          />
        </TabsContent>

        <TabsContent value="list" className="flex-1 p-6 m-0 overflow-auto scrollbar-custom">
          <TaskList tasks={filteredTasks} projectId={project.id} />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 p-6 m-0 overflow-hidden">
          <TaskTimeline tasks={filteredTasks} projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
