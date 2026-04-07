"use server"

import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { taskActivities, users, taskExecutions } from "@/lib/db/schema"
import type { TaskActivity } from "@/lib/db/schema"

export type ActivityWithUser = TaskActivity & {
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export type ActivityItem = ActivityWithUser | {
  id: number
  type: "comment"
  content: string
  createdAt: Date | null
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export async function getTaskActivityHistory(taskId: number): Promise<ActivityItem[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const activities = await db
    .select({
      activity: taskActivities,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(taskActivities)
    .innerJoin(users, eq(taskActivities.userId, users.id))
    .where(eq(taskActivities.taskId, taskId))
    .orderBy(desc(taskActivities.createdAt))

  return activities.map((a) => ({
    ...a.activity,
    user: a.user,
  }))
}

export async function createTaskActivity(
  taskId: number,
  type: string,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, unknown>
): Promise<ActivityWithUser> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [activity] = await db
    .insert(taskActivities)
    .values({
      taskId,
      userId,
      type,
      oldValue: oldValue || null,
      newValue: newValue || null,
      metadata: metadata || null,
    })
    .returning()

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return {
    ...activity,
    user: user || { id: userId, name: "Unknown", avatarUrl: null },
  }
}

export async function recordStatusChange(
  taskId: number,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  await createTaskActivity(taskId, "status_change", oldStatus, newStatus)
}

export async function recordPriorityChange(
  taskId: number,
  oldPriority: string,
  newPriority: string
): Promise<void> {
  await createTaskActivity(taskId, "priority_change", oldPriority, newPriority)
}

export async function recordAssigneeChange(
  taskId: number,
  oldAssignee: string | null,
  newAssignee: string | null,
  assigneeName?: string
): Promise<void> {
  await createTaskActivity(
    taskId,
    "assignee_change",
    oldAssignee,
    newAssignee,
    assigneeName ? { assigneeName } : undefined
  )
}

export async function recordTitleChange(
  taskId: number,
  oldTitle: string,
  newTitle: string
): Promise<void> {
  await createTaskActivity(taskId, "title_change", oldTitle, newTitle)
}

export async function recordDescriptionChange(
  taskId: number
): Promise<void> {
  await createTaskActivity(taskId, "description_change")
}

export async function recordExecutionStarted(
  taskId: number,
  executionId: number
): Promise<void> {
  await createTaskActivity(
    taskId,
    "execution_started",
    null,
    null,
    { executionId }
  )
}

export async function recordTaskCreated(taskId: number): Promise<void> {
  await createTaskActivity(taskId, "task_created")
}

export async function getActivityDisplayText(activity: ActivityWithUser): Promise<string> {
  const userName = activity.user.name
  const metadata = activity.metadata as { assigneeName?: string; executionId?: number } | null
  
  switch (activity.type) {
    case "status_change":
      return `${userName} changed status from "${activity.oldValue}" to "${activity.newValue}"`
    case "priority_change":
      return `${userName} changed priority from "${activity.oldValue}" to "${activity.newValue}"`
    case "assignee_change":
      if (!activity.oldValue && activity.newValue) {
        const assigneeName = metadata?.assigneeName || activity.newValue
        return `${userName} assigned to ${assigneeName}`
      } else if (activity.oldValue && !activity.newValue) {
        return `${userName} unassigned`
      } else {
        const assigneeName = metadata?.assigneeName || activity.newValue
        return `${userName} reassigned to ${assigneeName}`
      }
    case "title_change":
      return `${userName} updated the title`
    case "description_change":
      return `${userName} updated the description`
    case "execution_started":
      return `${userName} started an execution`
    case "task_created":
      return `${userName} created this task`
    default:
      return `${userName} performed an action`
  }
}
