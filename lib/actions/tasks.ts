"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, users, projects, organizations, taskExecutions, comments, type Task, type TaskExecution } from "@/lib/db/schema"
import { z } from "zod"
import { recordStatusChange, recordPriorityChange, recordAssigneeChange, recordTitleChange, recordDescriptionChange } from "./activity"

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().optional(),
  projectId: z.number(),
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "canceled"]).default("backlog"),
  priority: z.enum(["no_priority", "low", "medium", "high", "urgent"]).default("no_priority"),
  assigneeId: z.string().optional(),
  opencodeCommand: z.string().optional(),
  autoExecute: z.boolean().default(false),
  dueDate: z.string().optional(),
})

const updateTaskSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "canceled"]).optional(),
  priority: z.enum(["no_priority", "low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().nullable().optional(),
  opencodeCommand: z.string().nullable().optional(),
  autoExecute: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
})

export async function getTasks(projectId: number): Promise<Task[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt))
}

export async function getTask(taskId: number): Promise<Task | null> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  return task || null
}

export async function getTaskWithDetails(taskId: number): Promise<
  | (Task & {
      assignee?: { id: string; name: string; avatarUrl: string | null } | null
      creator?: { id: string; name: string; avatarUrl: string | null }
      project?: { id: number; name: string; slug: string; organizationId: number }
      _count?: { comments: number; executions: number }
    })
  | null
> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) return null

  const [assignee] = task.assigneeId
    ? await db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, task.assigneeId))
        .limit(1)
    : []

  const [creator] = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, task.creatorId))
    .limit(1)

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, task.projectId))
    .limit(1)

  const executionsCount = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.taskId, taskId))

  const commentsCount = await db
    .select()
    .from(comments)
    .where(eq(comments.taskId, taskId))

  return {
    ...task,
    assignee: assignee || null,
    creator,
    project,
    _count: {
      executions: executionsCount.length,
      comments: commentsCount.length,
    },
  }
}

export async function createTask(
  input: z.infer<typeof createTaskSchema>
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = createTaskSchema.parse(input)

  const [task] = await db
    .insert(tasks)
    .values({
      ...validated,
      creatorId: userId,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
    })
    .returning()

  revalidatePath(`/projects/${validated.projectId}`)
  return task
}

export async function updateTask(
  input: z.infer<typeof updateTaskSchema>
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = updateTaskSchema.parse(input)
  const { id, ...updateData } = validated

  // Get current task to compare changes
  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)

  if (!currentTask) {
    throw new Error("Task not found")
  }

  const updatePayload: Record<string, any> = { ...updateData }
  if (updateData.dueDate !== undefined) {
    updatePayload.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null
  }
  if (updateData.status === "done") {
    updatePayload.completedAt = new Date()
  }
  updatePayload.updatedAt = new Date()

  const [task] = await db
    .update(tasks)
    .set(updatePayload)
    .where(eq(tasks.id, id))
    .returning()

  // Record activity for changes
  if (updateData.status && updateData.status !== currentTask.status) {
    await recordStatusChange(id, currentTask.status, updateData.status)
  }
  if (updateData.priority && updateData.priority !== currentTask.priority) {
    await recordPriorityChange(id, currentTask.priority, updateData.priority)
  }
  if (updateData.assigneeId !== undefined && updateData.assigneeId !== currentTask.assigneeId) {
    await recordAssigneeChange(id, currentTask.assigneeId, updateData.assigneeId)
  }
  if (updateData.title && updateData.title !== currentTask.title) {
    await recordTitleChange(id, currentTask.title, updateData.title)
  }
  if (updateData.description !== undefined && updateData.description !== currentTask.description) {
    await recordDescriptionChange(id)
  }

  revalidatePath(`/tasks/${id}`)
  return task
}

export async function deleteTask(taskId: number): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) throw new Error("Task not found")

  await db.delete(tasks).where(eq(tasks.id, taskId))

  revalidatePath(`/projects/${task.projectId}`)
}

export async function updateTaskStatus(
  taskId: number,
  newStatus: Task["status"]
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!currentTask) {
    throw new Error("Task not found")
  }

  const updateData: Record<string, any> = {
    status: newStatus,
    updatedAt: new Date(),
  }

  if (newStatus === "done") {
    updateData.completedAt = new Date()
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, taskId))
    .returning()

  // Record activity
  await recordStatusChange(taskId, currentTask.status, newStatus)

  revalidatePath(`/tasks/${taskId}`)
  return task
}

export async function updateTaskPriority(
  taskId: number,
  newPriority: Task["priority"]
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!currentTask) {
    throw new Error("Task not found")
  }

  const [task] = await db
    .update(tasks)
    .set({
      priority: newPriority,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  // Record activity
  await recordPriorityChange(taskId, currentTask.priority, newPriority)

  revalidatePath(`/tasks/${taskId}`)
  return task
}

export async function updateTaskAssignee(
  taskId: number,
  newAssigneeId: string | null,
  assigneeName?: string
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!currentTask) {
    throw new Error("Task not found")
  }

  const [task] = await db
    .update(tasks)
    .set({
      assigneeId: newAssigneeId,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  // Record activity
  await recordAssigneeChange(taskId, currentTask.assigneeId, newAssigneeId, assigneeName)

  revalidatePath(`/tasks/${taskId}`)
  return task
}

export async function updateTaskDueDate(
  taskId: number,
  newDueDate: string | null | undefined
): Promise<Task> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [task] = await db
    .update(tasks)
    .set({
      dueDate: newDueDate ? new Date(newDueDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  if (!task) {
    throw new Error("Task not found")
  }

  revalidatePath(`/tasks/${taskId}`)
  return task
}

export async function moveTask(
  taskId: number,
  newStatus: string
): Promise<Task> {
  const statusMap: Record<string, Task["status"]> = {
    backlog: "backlog",
    todo: "todo",
    "in-progress": "in_progress",
    "in-review": "in_review",
    done: "done",
  }

  const status = statusMap[newStatus] || newStatus as Task["status"]
  return updateTaskStatus(taskId, status)
}
