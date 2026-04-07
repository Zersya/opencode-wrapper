"use client"

import * as React from "react"
import { GitPullRequest, Loader2 } from "lucide-react"
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
import { BranchSelector } from "./branch-selector"
import type { Branch, PullRequest } from "@/lib/git/actions"

interface CreatePullRequestDialogProps {
  branches: Branch[]
  defaultBranch?: string
  onCreatePR?: (title: string, body: string, head: string, base: string) => Promise<PullRequest>
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  className?: string
}

export function CreatePullRequestDialog({
  branches,
  defaultBranch,
  onCreatePR,
  onOpenChange,
  trigger,
  className,
}: CreatePullRequestDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [sourceBranch, setSourceBranch] = React.useState("")
  const [targetBranch, setTargetBranch] = React.useState(defaultBranch || "main")

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
    if (!newOpen) {
      setTitle("")
      setBody("")
      setSourceBranch("")
    }
  }

  const handleCreate = async () => {
    if (!title.trim() || !sourceBranch || !targetBranch) return

    setLoading(true)
    try {
      await onCreatePR?.(title, body, sourceBranch, targetBranch)
      handleOpenChange(false)
    } catch (error) {
      console.error("Failed to create PR:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className={cn("gap-2", className)}>
            <GitPullRequest className="h-4 w-4" />
            Create Pull Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1d21] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="pr-title">Title</Label>
            <Input
              id="pr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title for your pull request"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pr-body">Description</Label>
            <Textarea
              id="pr-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes..."
              className="bg-gray-800 border-gray-700 min-h-[100px]"
            />
          </div>

          {/* Branch Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From (source)</Label>
              <BranchSelector
                branches={branches}
                selectedBranch={sourceBranch}
                onSelect={setSourceBranch}
                placeholder="Select source branch"
              />
            </div>
            <div className="space-y-2">
              <Label>Into (target)</Label>
              <BranchSelector
                branches={branches}
                selectedBranch={targetBranch}
                onSelect={setTargetBranch}
                placeholder="Select target branch"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || !sourceBranch || !targetBranch || loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  Create Pull Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
