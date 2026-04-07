import { notFound } from "next/navigation"
import { TaskDetail } from "@/components/tasks/task-detail"
import { getTaskWithDetails } from "@/lib/actions/tasks"
import { getTaskComments } from "@/lib/actions/comments"
import { getTaskActivityHistory } from "@/lib/actions/activity"
import { getOrganizationMembers } from "@/lib/actions/organizations"

interface TaskPageProps {
  params: Promise<{ id: string }>
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { id } = await params
  const taskId = parseInt(id, 10)

  if (isNaN(taskId)) {
    notFound()
  }

  const task = await getTaskWithDetails(taskId)

  if (!task) {
    notFound()
  }

  // Fetch additional data in parallel
  const [comments, activities, members] = await Promise.all([
    getTaskComments(taskId),
    getTaskActivityHistory(taskId),
    task.project?.organizationId 
      ? getOrganizationMembers(task.project.organizationId)
      : Promise.resolve([]),
  ])

  return (
    <TaskDetail 
      task={task} 
      initialComments={comments}
      initialActivities={activities}
      organizationMembers={members}
    />
  )
}
