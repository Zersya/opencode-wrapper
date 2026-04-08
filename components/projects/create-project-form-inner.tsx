"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Folder, Loader2, Github, Gitlab } from "lucide-react"
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
import { createProject } from "@/lib/actions/projects"
import type { Project } from "@/lib/db/schema"

interface CreateProjectFormProps {
  organizationId: number
  onProjectCreated?: (project: Project) => void
  trigger?: React.ReactNode
  className?: string
}

export function CreateProjectFormInner({
  organizationId,
  onProjectCreated,
  trigger,
  className,
}: CreateProjectFormProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    description: "",
    gitProvider: undefined as "github" | "gitlab" | undefined,
    gitRepoUrl: "",
    gitBranch: "main",
  })

  React.useEffect(() => {
    if (formData.name && !formData.slug) {
      setFormData((prev) => ({
        ...prev,
        slug: formData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      }))
    }
  }, [formData.name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.slug.trim()) return

    setLoading(true)
    try {
      const project = await createProject({
        organizationId,
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        gitProvider: formData.gitProvider,
        gitRepoUrl: formData.gitRepoUrl || undefined,
        gitBranch: formData.gitBranch,
      })

      toast.success("Project created successfully")
      onProjectCreated?.(project)
      setOpen(false)
      setFormData({
        name: "",
        slug: "",
        description: "",
        gitProvider: undefined,
        gitRepoUrl: "",
        gitBranch: "main",
      })
      router.push(`/projects/${project.slug}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project")
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
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1d21] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Create new project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="My Awesome Project"
              className="bg-gray-800 border-gray-700"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug
              <span className="text-xs text-gray-500 ml-2">
                (used in URLs, lowercase with hyphens)
              </span>
            </Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              placeholder="my-awesome-project"
              className="bg-gray-800 border-gray-700 font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="What is this project about?"
              className="bg-gray-800 border-gray-700 min-h-[80px]"
            />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm font-medium text-white mb-3">
              Git Repository (optional)
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Git Provider</Label>
                <Select
                  value={formData.gitProvider}
                  onValueChange={(value: "github" | "gitlab") =>
                    setFormData({ ...formData, gitProvider: value })
                  }
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d21] border-gray-800">
                    <SelectItem
                      value="github"
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        GitHub
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="gitlab"
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Gitlab className="h-4 w-4" />
                        GitLab
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Default Branch</Label>
                <Input
                  id="branch"
                  value={formData.gitBranch}
                  onChange={(e) =>
                    setFormData({ ...formData, gitBranch: e.target.value })
                  }
                  placeholder="main"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repoUrl">Repository URL</Label>
              <Input
                id="repoUrl"
                value={formData.gitRepoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, gitRepoUrl: e.target.value })
                }
                placeholder="https://github.com/username/repo"
                className="bg-gray-800 border-gray-700"
              />
            </div>
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
            <Button
              type="submit"
              disabled={loading || !formData.name.trim() || !formData.slug.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Folder className="h-4 w-4 mr-2" />
                  Create project
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
