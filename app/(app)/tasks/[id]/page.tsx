"use client"

import { notFound, useRouter } from "next/navigation"
import { TaskDetail } from "@/components/tasks/task-detail"
import { useEffect, useState } from "react"
import type { Task } from "@/lib/db/schema"
import type { CommentWithUser } from "@/lib/actions/comments"
import type { ActivityItem } from "@/lib/actions/activity"

interface TaskPageProps {
  params: Promise<{ id: string }>
}

export default function TaskPage({ params }: TaskPageProps) {
  const router = useRouter()
  const [task, setTask] = useState<Task & {
    assignee?: { id: string; name: string; avatarUrl: string | null } | null
    creator?: { id: string; name: string; avatarUrl: string | null }
    project?: { id: number; name: string; slug: string; organizationId: number }
    _count?: { comments: number; executions: number }
  } | null>(null)
  const [comments, setComments] = useState<CommentWithUser[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [members, setMembers] = useState<Array<{
    id: number
    role: string
    joinedAt: Date | null
    user: {
      id: string
      name: string
      email: string
      avatarUrl: string | null
    }
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { id } = await params
      const taskId = parseInt(id, 10)

      if (isNaN(taskId)) {
        notFound()
      }

      // Dynamically import server actions to avoid bundling issues
      const [{ getTaskWithDetails }, { getTaskComments }, { getTaskActivityHistory }, { getOrganizationMembers }] = await Promise.all([
        import("@/lib/actions/tasks"),
        import("@/lib/actions/comments"),
        import("@/lib/actions/activity"),
        import("@/lib/actions/organizations"),
      ])

      const taskData = await getTaskWithDetails(taskId)

      if (!taskData) {
        notFound()
      }

      const [commentsData, activitiesData, membersData] = await Promise.all([
        getTaskComments(taskId),
        getTaskActivityHistory(taskId),
        taskData.project?.organizationId 
          ? getOrganizationMembers(taskData.project.organizationId)
          : Promise.resolve([]),
      ])

      setTask(taskData)
      setComments(commentsData)
      setActivities(activitiesData)
      setMembers(membersData)
      setLoading(false)
    }

    loadData()
  }, [params])

  const handleClose = () => {
    if (task?.project?.slug) {
      router.push(`/projects/${task.project.slug}`)
    } else {
      router.push("/dashboard")
    }
  }

  if (loading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <TaskDetail 
      task={task} 
      initialComments={comments}
      initialActivities={activities}
      organizationMembers={members}
      onClose={handleClose}
    />
  )
}
