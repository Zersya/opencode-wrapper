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
import { previewOpencodeCommand } from "@/lib/actions/command-generator"
import type { Task } from "@/lib/db/schema"

interface CreateTaskFormProps {
  projectId: number
  organizationId?: number
  defaultStatus?: Task["status"]
  onTaskCreated?: (task: Task) => void
  trigger?: React.ReactNode
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
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
  organizationId,
  defaultStatus = "backlog",
  onTaskCreated,
  trigger,
  className,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: CreateTaskFormProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedExplanation, setGeneratedExplanation] = React.useState<string | null>(null)
  
  // Use external control if provided, otherwise use internal state
  const isControlled = externalOpen !== undefined
  const open = isControlled ? externalOpen : internalOpen
  const setOpen = isControlled ? externalOnOpenChange! : setInternalOpen
  
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    status: defaultStatus,
    priority: "no_priority" as Task["priority"],
    opencodeCommand: "",
    autoExecute: false,
  })

  // Update status when defaultStatus prop changes (for kanban column clicks)
  React.useEffect(() => {
    setFormData((prev) => ({ ...prev, status: defaultStatus }))
  }, [defaultStatus])

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

  const handleGenerateCommand = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a task title first")
      return
    }

    setIsGenerating(true)
    setGeneratedExplanation(null)
    
    try {
      const result = await previewOpencodeCommand(
        formData.title,
        formData.description,
        organizationId
      )
      
      setFormData(prev => ({
        ...prev,
        opencodeCommand: result.command,
        autoExecute: result.autoExecute,
      }))
      setGeneratedExplanation(result.explanation)
      
      toast.success("Command generated!", {
        description: result.explanation,
      })
    } catch (error) {
      toast.error("Failed to generate command", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button className={cn("gap-2", className)}>
              <Plus className="h-4 w-4" />
              New task
            </Button>
          )}
        </DialogTrigger>
      )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="opencodeCommand">OpenCode Command</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                onClick={handleGenerateCommand}
                disabled={isGenerating || !formData.title.trim()}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {isGenerating ? "Thinking..." : "AI Generate"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                id="opencodeCommand"
                value={formData.opencodeCommand}
                onChange={(e) =>
                  setFormData({ ...formData, opencodeCommand: e.target.value })
                }
                placeholder="e.g., fix login bug or click AI Generate"
                className="flex-1 bg-gray-800 border-gray-700 font-mono text-sm"
              />
            </div>
            {generatedExplanation && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {generatedExplanation}
              </p>
            )}
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
