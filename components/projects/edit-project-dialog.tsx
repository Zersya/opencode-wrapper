"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { updateProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

interface EditProjectDialogProps {
  project: Project
  trigger?: React.ReactNode
}

export function EditProjectDialog({ project, trigger }: EditProjectDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: project.name,
    description: project.description || "",
  })
  const [errors, setErrors] = React.useState<{ name?: string }>({})
  const router = useRouter()

  React.useEffect(() => {
    if (open) {
      setFormData({
        name: project.name,
        description: project.description || "",
      })
      setErrors({})
    }
  }, [open, project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: { name?: string } = {}
    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }
    if (formData.name.length > 100) {
      newErrors.name = "Name must be 100 characters or less"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setIsLoading(true)
      await updateProject({
        id: project.id,
        name: formData.name,
        description: formData.description,
      })
      toast.success("Project updated successfully")
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 focus:bg-gray-800 focus:text-white"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#1a1d21] border-gray-800 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Project</DialogTitle>
          <DialogDescription className="text-gray-400">
            Make changes to your project here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (errors.name) setErrors({ ...errors, name: undefined })
              }}
              placeholder="Enter project name"
              className={cn(
                "bg-[#0f1115] border-gray-700 text-white",
                errors.name && "border-red-500"
              )}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter project description"
              className="bg-[#0f1115] border-gray-700 text-white min-h-[80px]"
            />
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
