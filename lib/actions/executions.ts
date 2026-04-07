"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, taskExecutions, organizations, type TaskExecution } from "@/lib/db/schema"
import { decryptApiKey } from "@/lib/server/encryption"
import {
  startExecution,
  stopExecution,
  getExecution,
  listTaskExecutions,
  getExecutionOutput,
  type ExecutionOptions,
} from "@/lib/server/cli-executor"
import { getCustomProviderEnvVars } from "./custom-providers"

export async function executeTask(taskId: number): Promise<TaskExecution> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) throw new Error("Task not found")
  if (!task.opencodeCommand) throw new Error("Task has no opencode command")

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, task.projectId))
    .limit(1)

  const env: Record<string, string> = {}

  if (org?.openaiApiKey) {
    env.OPENAI_API_KEY = decryptApiKey(org.openaiApiKey)
  }
  if (org?.anthropicApiKey) {
    env.ANTHROPIC_API_KEY = decryptApiKey(org.anthropicApiKey)
  }

  // Add custom provider environment variables
  try {
    const customProviderEnvVars = await getCustomProviderEnvVars(org?.id || 1)
    Object.assign(env, customProviderEnvVars)
  } catch (error) {
    console.error("Failed to load custom provider env vars:", error)
  }

  const execution = await startExecution({
    taskId,
    userId,
    organizationId: org?.id || 1,
    command: task.opencodeCommand,
    workingDirectory: `/workspace/${org?.slug || "default"}`,
    env,
  })

  revalidatePath(`/tasks/${taskId}`)
  return execution
}

export async function cancelExecution(executionId: number): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  await stopExecution(executionId)
  revalidatePath(`/executions/${executionId}`)
}

export async function getTaskExecutions(taskId: number): Promise<TaskExecution[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  return listTaskExecutions(taskId)
}

export async function getExecutionById(executionId: number): Promise<TaskExecution | null> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  return getExecution(executionId)
}

export async function pollExecutionOutput(
  executionId: number,
  fromPosition: number = 0
): Promise<{ output: string; position: number; status: string; isComplete: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const result = await getExecutionOutput(executionId)
  const newOutput = result.output.slice(fromPosition)
  const isComplete = ["success", "failed", "canceled"].includes(result.status)

  return {
    output: newOutput,
    position: result.output.length,
    status: result.status,
    isComplete,
  }
}

export async function retryExecution(
  executionId: number
): Promise<TaskExecution> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [execution] = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .limit(1)

  if (!execution) throw new Error("Execution not found")

  return executeTask(execution.taskId)
}

export async function getExecutionWithDetails(executionId: number): Promise<
  (TaskExecution & {
    task?: { id: number; title: string; projectId: number; opencodeCommand: string | null }
    user?: { id: string; name: string }
    organization?: { id: number; name: string }
  }) | null
> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [execution] = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .limit(1)

  if (!execution) return null

  const [task] = await db
    .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId, opencodeCommand: tasks.opencodeCommand })
    .from(tasks)
    .where(eq(tasks.id, execution.taskId))
    .limit(1)

  return {
    ...execution,
    task: task || undefined,
  }
}
