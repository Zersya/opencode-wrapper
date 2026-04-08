import { spawn, type ChildProcess } from "child_process"
import { db } from "@/lib/db"
import { taskExecutions, type TaskExecution } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { execInContainer } from "./docker-manager"
import { cloneRepository } from "./git-clone"

function parseCommand(command: string): string[] {
  const args: string[] = []
  let current = ""
  let inQuotes = false
  let quoteChar = ""

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ""
    } else if (char === " " && !inQuotes) {
      if (current) {
        args.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

export interface ExecutionOptions {
  taskId: number
  projectId: number
  userId: string
  organizationId: number
  command: string
  workingDirectory: string
  env?: Record<string, string>
  branch?: string
}

export interface ExecutionResult {
  id: number
  status: TaskExecution["status"]
  output: string
  exitCode?: number
  startedAt?: Date
  completedAt?: Date
}

export interface RunningExecution {
  process: ChildProcess | null
  containerExec: Promise<void> | null
  output: string[]
  status: "running" | "success" | "failed" | "canceled"
}

const runningExecutions = new Map<number, RunningExecution>()

export async function startExecution(
  options: ExecutionOptions
): Promise<TaskExecution> {
  const [execution] = await db
    .insert(taskExecutions)
    .values({
      taskId: options.taskId,
      userId: options.userId,
      organizationId: options.organizationId,
      status: "pending",
      command: options.command,
      workingDirectory: options.workingDirectory,
    })
    .returning()

  runExecution(execution.id, options).catch(console.error)

  return execution
}

async function runExecution(
  executionId: number,
  options: ExecutionOptions
): Promise<void> {
  try {
    await db
      .update(taskExecutions)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(taskExecutions.id, executionId))

    const running: RunningExecution = {
      process: null,
      containerExec: null,
      output: [],
      status: "running",
    }
    runningExecutions.set(executionId, running)

    const outputChunks: string[] = []

    const appendOutput = (data: string) => {
      outputChunks.push(data)
      running.output.push(data)
    }

    const useDocker = process.env.USE_DOCKER === "true"

    appendOutput("[opencode-wrapper] Cloning repository...\n")
    const cloneResult = await cloneRepository({
      projectId: options.projectId,
      workingDirectory: options.workingDirectory,
      branch: options.branch,
      useDocker,
      containerId: useDocker ? `opencode-org-${options.organizationId}` : undefined,
    })

    if (!cloneResult.success && !cloneResult.error?.includes("already exists")) {
      appendOutput(`[opencode-wrapper] Clone failed: ${cloneResult.error}\n`)
      await db
        .update(taskExecutions)
        .set({
          status: "failed",
          output: outputChunks.join(""),
          completedAt: new Date(),
        })
        .where(eq(taskExecutions.id, executionId))
      running.status = "failed"
      return
    }

    appendOutput(`[opencode-wrapper] Repository ready at: ${cloneResult.path}\n`)
    appendOutput(`[opencode-wrapper] Starting opencode execution...\n\n`)

    const workingDir = cloneResult.path || options.workingDirectory
    const commandArgs = parseCommand(options.command)

    if (useDocker) {
      const envVars: Record<string, string> = {
        ...options.env,
      }

      if (options.env?.OPENAI_API_KEY) {
        envVars.OPENAI_API_KEY = options.env.OPENAI_API_KEY
      }
      if (options.env?.ANTHROPIC_API_KEY) {
        envVars.ANTHROPIC_API_KEY = options.env.ANTHROPIC_API_KEY
      }

      const containerName = `opencode-org-${options.organizationId}`
      const result = await execInContainer(
        containerName,
        ["opencode", ...commandArgs],
        { cwd: workingDir, env: envVars }
      )

      appendOutput(result.stdout)
      appendOutput(result.stderr)

      await db
        .update(taskExecutions)
        .set({
          status: result.exitCode === 0 ? "success" : "failed",
          output: outputChunks.join(""),
          exitCode: result.exitCode,
          completedAt: new Date(),
        })
        .where(eq(taskExecutions.id, executionId))

      running.status = result.exitCode === 0 ? "success" : "failed"
    } else {
      const env = {
        ...process.env,
        ...options.env,
      }

      const child = spawn("opencode", commandArgs, {
        cwd: workingDir,
        env,
        shell: true,
      })

      running.process = child

      child.stdout?.on("data", (data) => {
        const str = data.toString()
        appendOutput(str)
      })

      child.stderr?.on("data", (data) => {
        const str = data.toString()
        appendOutput(str)
      })

      await new Promise<void>((resolve) => {
        child.on("close", async (code) => {
          const status = code === 0 ? "success" : "failed"

          await db
            .update(taskExecutions)
            .set({
              status,
              output: outputChunks.join(""),
              exitCode: code ?? undefined,
              completedAt: new Date(),
            })
            .where(eq(taskExecutions.id, executionId))

          running.status = status
          resolve()
        })

        child.on("error", async (error) => {
          appendOutput(`Error: ${error.message}`)

          await db
            .update(taskExecutions)
            .set({
              status: "failed",
              output: outputChunks.join(""),
              completedAt: new Date(),
            })
            .where(eq(taskExecutions.id, executionId))

          running.status = "failed"
          resolve()
        })
      })
    }
  } catch (error) {
    console.error("Execution failed:", error)

    await db
      .update(taskExecutions)
      .set({
        status: "failed",
        output: `Execution error: ${error}`,
        completedAt: new Date(),
      })
      .where(eq(taskExecutions.id, executionId))

    const running = runningExecutions.get(executionId)
    if (running) {
      running.status = "failed"
    }
  } finally {
    runningExecutions.delete(executionId)
  }
}

export async function stopExecution(executionId: number): Promise<void> {
  const running = runningExecutions.get(executionId)
  if (!running) return

  if (running.process) {
    running.process.kill("SIGTERM")
  }

  running.status = "canceled"

  await db
    .update(taskExecutions)
    .set({
      status: "canceled",
      completedAt: new Date(),
    })
    .where(eq(taskExecutions.id, executionId))
}

export async function getExecutionOutput(
  executionId: number
): Promise<{ output: string; position: number; status: string }> {
  const [execution] = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .limit(1)

  if (!execution) {
    throw new Error("Execution not found")
  }

  return {
    output: execution.output || "",
    position: (execution.output?.length || 0),
    status: execution.status,
  }
}

export async function getExecution(executionId: number): Promise<TaskExecution | null> {
  const [execution] = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .limit(1)

  return execution || null
}

export async function listTaskExecutions(taskId: number): Promise<TaskExecution[]> {
  return db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.taskId, taskId))
}

export function isExecutionRunning(executionId: number): boolean {
  const running = runningExecutions.get(executionId)
  return running?.status === "running"
}
