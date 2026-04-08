import { spawn, exec, type ChildProcess } from "child_process"
import { promisify } from "util"
import { db } from "@/lib/db"
import { taskExecutions, projects, type TaskExecution } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { execInContainer } from "./docker-manager"
import { cloneRepository } from "./git-clone"
import { ensureOpenCodeInstalled } from "./opencode-installer"
import { 
  getOrganizationWorkspacePath, 
  ensureWorkspaceExists 
} from "./workspace"
import {
  publishOutput,
  publishStatus,
  publishComplete,
  publishError,
} from "./execution-stream"
import { createOpenCodeClient, type OpenCodeEvent } from "./opencode-api-client"

const execAsync = promisify(exec)

// Escape special shell characters in an argument
function escapeShellArg(arg: string): string {
  // If the argument contains special characters, wrap it in single quotes
  // and handle any existing single quotes by ending the quote, adding an escaped quote, and restarting
  if (/[^a-zA-Z0-9_\-\/\.]/.test(arg)) {
    return "'" + arg.replace(/'/g, "'\"'\"'") + "'"
  }
  return arg
}

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
  orgSlug: string
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

// Use globalThis to ensure Map is shared across all module instances
// (prevents issues with Next.js hot-reload and ESM module duplication)
declare global {
  // eslint-disable-next-line no-var
  var __runningExecutions: Map<number, RunningExecution> | undefined
}

const runningExecutions: Map<number, RunningExecution> = 
  globalThis.__runningExecutions || (globalThis.__runningExecutions = new Map())

export { runningExecutions }

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
      // Real-time publish to SSE subscribers
      publishOutput(executionId, data)
    }

    const useDocker = process.env.USE_DOCKER === "true"

    // Publish status change to running
    publishStatus(executionId, "running")

    // Check if project has a git repo configured
    const { gitRepoUrl } = await db
      .select({ gitRepoUrl: projects.gitRepoUrl })
      .from(projects)
      .where(eq(projects.id, options.projectId))
      .limit(1)
      .then(rows => rows[0] || { gitRepoUrl: null })

    // Ensure workspace directory exists
    const workspacePath = ensureWorkspaceExists(options.orgSlug)
    appendOutput(`[opencode-wrapper] Workspace ready at: ${workspacePath}\n`)
    
    let cloneResult: { success: boolean; path: string; error?: string }
    
    if (gitRepoUrl) {
      appendOutput("[opencode-wrapper] Cloning repository...\n")
      cloneResult = await cloneRepository({
        projectId: options.projectId,
        workingDirectory: workspacePath,
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
        // Publish error event
        publishError(executionId, cloneResult.error || "Repository cloning failed")
        return
      }

      appendOutput(`[opencode-wrapper] Repository ready at: ${cloneResult.path}\n`)
    } else {
      // No git repo configured, use workspace directory directly
      cloneResult = { success: true, path: workspacePath }
      appendOutput(`[opencode-wrapper] Using workspace directory: ${workspacePath}\n`)
    }

    appendOutput(`[opencode-wrapper] Starting opencode execution...\n\n`)

    const workingDir = cloneResult.path || options.workingDirectory
    
    // Validate and clean the command before execution
    let command = options.command.trim()
    
    console.log(`[cli-executor] Raw command from DB: "${command}"`)
    
    // Extract just the command part - opencode commands are: /command [description]
    // Remove any explanation text that the AI might have included
    // Look for patterns like: "/command ..." or "command: /command ..." or just "/command"
    const commandMatch = command.match(/(?:command[:\s]*)?(\/\w+(?:\s+[^.\n]+)?)/i)
    if (commandMatch) {
      command = commandMatch[1].trim()
      console.log(`[cli-executor] Extracted command: "${command}"`)
    } else if (command.length > 100 || command.includes('Since') || command.includes('because')) {
      console.warn(`[cli-executor] Command appears to contain explanation text, attempting cleanup...`)
      
      // Take just the first line and look for /something
      const firstLine = command.split('\n')[0].trim()
      const slashMatch = firstLine.match(/(\/\w+)/)
      if (slashMatch) {
        command = slashMatch[1]
        console.log(`[cli-executor] Extracted command from first line: "${command}"`)
      }
    }
    
    // Ensure command starts with /
    if (!command.startsWith('/')) {
      command = '/' + command
    }
    
    // Parse the command into parts: command and arguments
    const firstSpaceIndex = command.indexOf(' ')
    if (firstSpaceIndex > 0) {
      // Has arguments: "/command arg1 arg2"
      const cmd = command.substring(0, firstSpaceIndex)
      const args = command.substring(firstSpaceIndex + 1).trim()
      command = cmd + ' ' + args
    }
    
    console.log(`[cli-executor] Final command to execute: "${command}"`)
    
    const commandArgs = parseCommand(command)

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
      
      // Ensure directory exists in container
      if (!gitRepoUrl) {
        const mkdirResult = await execInContainer(
          containerName,
          ["mkdir", "-p", workingDir],
          { cwd: workingDir }
        )
        if (mkdirResult.exitCode !== 0) {
          appendOutput(`[opencode-wrapper] Failed to create directory: ${mkdirResult.stderr}\n`)
        }
      }
      
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
      // Publish completion event
      publishComplete(
        executionId,
        result.exitCode === 0 ? "success" : "failed",
        result.exitCode ?? undefined
      )
    } else {
      // Check and ensure opencode is installed before spawning
      const installCheck = await ensureOpenCodeInstalled()
      
      if (!installCheck.installed) {
        appendOutput(`[opencode-wrapper] Failed to install OpenCode CLI: ${installCheck.error}\n`)
        await db
          .update(taskExecutions)
          .set({
            status: "failed",
            output: outputChunks.join(""),
            completedAt: new Date(),
          })
          .where(eq(taskExecutions.id, executionId))
        running.status = "failed"
        publishError(executionId, `OpenCode CLI installation failed: ${installCheck.error}`)
        return
      }
      
      appendOutput(`[opencode-wrapper] OpenCode CLI ready: ${installCheck.version} at ${installCheck.path}\n`)
      
      // FORCE UNBUFFERED OUTPUT - This is the key fix!
      const env = {
        ...process.env,
        ...options.env,
        // Force Node.js to flush output immediately
        NODE_OPTIONS: "--no-warnings",
        // Disable all buffering
        FORCE_COLOR: "1",
        TERM: "xterm-256color",
        // Python unbuffered (if opencode uses Python internally)
        PYTHONUNBUFFERED: "1",
        // Node.js unbuffered
        NODE_NO_WARNINGS: "1",
      }

      // Use the full path to opencode to avoid PATH issues
      const opencodePath = installCheck.path || "opencode"
      
      // Build the command for opencode CLI
      const commandString = commandArgs.join(' ')
      
      // Construct full command: opencode run "/command description"
      // DO NOT use shell string concatenation - pass args directly to avoid shell buffering
      const fullArgs = [
        "run",
        commandString,
        "--print-logs", // Force log output to stderr for real-time streaming
      ]
      
      console.log(`[cli-executor] Command: "${commandString}"`)
      console.log(`[cli-executor] Args:`, fullArgs)
      console.log(`[cli-executor] Working directory:`, workingDir)
      
      // Spawn WITHOUT shell to avoid shell buffering
      // Use 'pipe' for all stdio to ensure we capture everything
      const child = spawn(opencodePath, fullArgs, {
        cwd: workingDir,
        env,
        shell: false, // CRITICAL: Don't use shell - it adds buffering
        detached: false, // Keep attached so we can track output
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      running.process = child

      // Handle stdout data - FLUSH IMMEDIATELY
      child.stdout?.on("data", (data) => {
        const str = data.toString()
        console.log(`[cli-executor] stdout: ${str.substring(0, 100)}...`)
        appendOutput(str)
      })

      // Handle stderr data - FLUSH IMMEDIATELY  
      child.stderr?.on("data", (data) => {
        const str = data.toString()
        console.log(`[cli-executor] stderr: ${str.substring(0, 100)}...`)
        appendOutput(str)
      })
      
      // Handle process errors (spawn failures, etc)
      child.on("error", (error) => {
        console.error(`[cli-executor] Process error:`, error)
        appendOutput(`[opencode-wrapper] Process error: ${error.message}\n`)
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
          // Publish completion event
          publishComplete(executionId, status, code ?? undefined)
          resolve()
        })

        child.on("error", async (error) => {
          let errorMessage = error.message
          
          // Provide more helpful error messages
          if (error.message.includes("ENOENT")) {
            // Check if it's the directory or the command that's missing
            try {
              await execAsync(`test -d "${workingDir}"`)
              errorMessage = "OpenCode CLI not found in PATH after installation attempt. Try restarting the server or install manually: npm install -g @anthropic/opencode"
            } catch {
              errorMessage = `Working directory does not exist: ${workingDir}`
            }
          }
          
          appendOutput(`Error: ${errorMessage}`)

          await db
            .update(taskExecutions)
            .set({
              status: "failed",
              output: outputChunks.join(""),
              completedAt: new Date(),
            })
            .where(eq(taskExecutions.id, executionId))

          running.status = "failed"
          // Publish error event
          publishError(executionId, errorMessage)
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
    // Publish error event
    publishError(executionId, String(error))
  } finally {
    runningExecutions.delete(executionId)
  }
}

export async function stopExecution(executionId: number): Promise<void> {
  const running = runningExecutions.get(executionId)
  if (!running) {
    console.log(`[cli-executor] No running execution found for ${executionId}`)
    return
  }

  if (running.process) {
    const pid = running.process.pid
    console.log(`[cli-executor] Stopping execution ${executionId}, PID: ${pid}`)
    
    try {
      // Kill the entire process group (negative PID)
      // This works because we spawned with detached: true
      if (pid) {
        // On Unix, negative PID kills the process group
        // On Windows, we need to use taskkill
        if (process.platform === 'win32') {
          // Use taskkill to kill process tree on Windows
          await execAsync(`taskkill /pid ${pid} /T /F`)
        } else {
          // Kill process group on Unix
          process.kill(-pid, 'SIGTERM')
          
          // Give it a moment to terminate gracefully
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Force kill if still running
          try {
            process.kill(-pid, 0) // Check if process exists
            process.kill(-pid, 'SIGKILL') // Force kill
          } catch {
            // Process already dead
          }
        }
      }
      
      // Also kill the main process directly as backup
      running.process.kill('SIGTERM')
    } catch (error) {
      console.error(`[cli-executor] Error killing process:`, error)
      // Try direct kill as fallback
      try {
        running.process.kill('SIGKILL')
      } catch {
        // Ignore if already dead
      }
    }
  }

  running.status = "canceled"

  await db
    .update(taskExecutions)
    .set({
      status: "canceled",
      completedAt: new Date(),
    })
    .where(eq(taskExecutions.id, executionId))

  // Publish completion with canceled status
  publishComplete(executionId, "canceled")
  
  console.log(`[cli-executor] Execution ${executionId} stopped and marked as canceled`)
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
