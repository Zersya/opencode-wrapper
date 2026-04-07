"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash, AlertTriangle } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { deleteProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/db/schema"

interface DeleteProjectDialogProps {
  project: Project
  trigger?: React.ReactNode
}

export function DeleteProjectDialog({ project, trigger }: DeleteProjectDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    if (open) {
      setConfirmText("")
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (confirmText.trim() !== project.name) {
      setError("Project name doesn't match")
      return
    }

    try {
      setIsLoading(true)
      await deleteProject(project.id)
      toast.success("Project deleted successfully")
      setOpen(false)
      router.push("/projects")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project")
    } finally {
      setIsLoading(false)
    }
  }

  const isConfirmValid = confirmText.trim() === project.name

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 focus:bg-gray-800 focus:text-red-400"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#1a1d21] border-gray-800 text-white sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <DialogTitle className="text-lg font-semibold">Delete Project</DialogTitle>
          </div>
          <DialogDescription className="text-gray-400 mt-3">
            This action cannot be undone. This will permanently delete the project
            <strong className="text-white"> &quot;{project.name}&quot;</strong> and all of its tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-gray-300">
              To confirm, type <strong className="text-white">&quot;{project.name}&quot;</strong> below:
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                if (error) setError(null)
              }}
              placeholder={`Type "${project.name}" to confirm`}
              className="bg-[#0f1115] border-gray-700 text-white"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !isConfirmValid}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isLoading ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
