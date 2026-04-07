"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Zap, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTask } from "@/lib/actions/tasks"
import type { Task } from "@/lib/db/schema"

interface CreateTaskFormProps {
  projectId: number
  defaultStatus?: Task["status"]
  onTaskCreated?: (task: Task) => void
  trigger?: React.ReactNode
  className?: string
}

const statusOptions: { value: Task["status"]; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
]

const priorityOptions: { value: Task["priority"]; label: string; color: string }[] = [
  { value: "no_priority", label: "No priority", color: "bg-gray-600" },
  { value: "low", label: "Low", color: "bg-gray-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-amber-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
]

export function CreateTaskForm({
  projectId,
  defaultStatus = "backlog",
  onTaskCreated,
  trigger,
  className,
}: CreateTaskFormProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    status: defaultStatus,
    priority: "no_priority" as Task["priority"],
    opencodeCommand: "",
    autoExecute: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      const task = await createTask({
        projectId,
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        opencodeCommand: formData.opencodeCommand || undefined,
        autoExecute: formData.autoExecute,
      })

      toast.success("Task created successfully")
      onTaskCreated?.(task)
      setOpen(false)
      setFormData({
        title: "",
        description: "",
        status: defaultStatus,
        priority: "no_priority",
        opencodeCommand: "",
        autoExecute: false,
      })
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className={cn("gap-2", className)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1d21] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Create new task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What needs to be done?"
              className="bg-gray-800 border-gray-700"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more details..."
              className="bg-gray-800 border-gray-700 min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: Task["status"]) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d21] border-gray-800">
                  {statusOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: Task["priority"]) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d21] border-gray-800">
                  {priorityOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-sm", option.color)} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opencodeCommand">OpenCode Command (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="opencodeCommand"
                value={formData.opencodeCommand}
                onChange={(e) =>
                  setFormData({ ...formData, opencodeCommand: e.target.value })
                }
                placeholder="e.g., fix login bug"
                className="flex-1 bg-gray-800 border-gray-700 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              The opencode CLI will execute this command when the task is run
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoExecute"
              checked={formData.autoExecute}
              onChange={(e) =>
                setFormData({ ...formData, autoExecute: e.target.checked })
              }
              className="w-4 h-4 rounded bg-gray-800 border-gray-700"
            />
            <Label htmlFor="autoExecute" className="flex items-center gap-2 cursor-pointer">
              <Zap className="h-4 w-4 text-amber-400" />
              Auto-execute when moved to In Progress
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-700"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
