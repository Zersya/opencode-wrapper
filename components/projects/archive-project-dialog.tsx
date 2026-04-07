"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Archive } from "lucide-react"
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
import { toast } from "sonner"
import { updateProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/db/schema"

interface ArchiveProjectDialogProps {
  project: Project
  trigger?: React.ReactNode
}

export function ArchiveProjectDialog({ project, trigger }: ArchiveProjectDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

  const isArchived = project.status === "archived"

  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      await updateProject({
        id: project.id,
        status: isArchived ? "active" : "archived",
      })
      toast.success(isArchived ? "Project restored successfully" : "Project archived successfully")
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive project")
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
            <Archive className="mr-2 h-4 w-4" />
            {isArchived ? "Restore Project" : "Archive Project"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#1a1d21] border-gray-800 text-white sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isArchived ? "Restore Project" : "Archive Project"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isArchived
              ? `Are you sure you want to restore "${project.name}"? The project will become active again.`
              : `Are you sure you want to archive "${project.name}"? The project will be moved to archived status but can be restored later.`}
          </DialogDescription>
        </DialogHeader>

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
            onClick={handleSubmit}
            disabled={isLoading}
            className={isArchived ? "bg-primary hover:bg-primary/90" : "bg-amber-500 hover:bg-amber-600"}
          >
            {isLoading
              ? isArchived ? "Restoring..." : "Archiving..."
              : isArchived ? "Restore Project" : "Archive Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
