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
  publishQuestion,
} from "./execution-stream"
import { createOpenCodeClient, type OpenCodeEvent } from "./opencode-api-client"
import { processOutput, type ProcessedOutput } from "./output-filter"

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
  waitingForInput: boolean
  questionPrompt?: string
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
      waitingForInput: false,
    }
    runningExecutions.set(executionId, running)

    const outputChunks: string[] = []

    const logWrapper = (message: string) => {
      const fullMessage = `[opencode-wrapper] ${message}\n`
      outputChunks.push(fullMessage)
      running.output.push(fullMessage)
      // Only log important wrapper messages
      if (message.includes("error") || message.includes("failed") || message.includes("Error")) {
        console.log(`[opencode] ⚠️ ${message}`)
      }
    }

    const appendOutput = (data: string, forceDisplay: boolean = false) => {
      outputChunks.push(data)
      running.output.push(data)
      
      const processed = processOutput(data)
      
      if (forceDisplay || processed.shouldDisplay) {
        publishOutput(executionId, processed.content)
        
        if (processed.isQuestion) {
          running.waitingForInput = true
          running.questionPrompt = processed.content
          console.log(`[opencode] ❓ Question detected (${processed.questionType}): ${processed.content.substring(0, 60)}...`)
          
          publishQuestion(
            executionId,
            processed.content,
            processed.questionType || "input"
          )
        }
      }
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
    logWrapper(`Workspace ready at: ${workspacePath}`)
    
    let cloneResult: { success: boolean; path: string; error?: string }
    
    if (gitRepoUrl) {
      logWrapper("Cloning repository...")
      cloneResult = await cloneRepository({
        projectId: options.projectId,
        workingDirectory: workspacePath,
        branch: options.branch,
        useDocker,
        containerId: useDocker ? `opencode-org-${options.organizationId}` : undefined,
      })

      if (!cloneResult.success && !cloneResult.error?.includes("already exists")) {
        logWrapper(`Clone failed: ${cloneResult.error}`)
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

      logWrapper(`Repository ready at: ${cloneResult.path}`)
    } else {
      // No git repo configured - use the current project directory
      // The workspace is empty, so we should work in the actual project
      cloneResult = { success: true, path: process.cwd() }
      logWrapper(`No git repo configured - using current project directory: ${process.cwd()}`)
      logWrapper(`TIP: Configure a git repo in project settings to work with a specific repository`)
    }

    logWrapper("Starting opencode execution...")

    const workingDir = cloneResult.path || options.workingDirectory || process.cwd()
    
    // Use the command as-is (natural language)
    // OpenCode works best with descriptive natural language prompts
    const command = options.command.trim()
    
    console.log(`[opencode] ▶️ Executing: "${command.substring(0, 60)}${command.length > 60 ? '...' : ''}"`)

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
          logWrapper(`Failed to create directory: ${mkdirResult.stderr}`)
        }
      }
      
      // Build opencode command - now using natural language
      // opencode run "natural language description" --print-logs --dangerously-skip-permissions
      const opencodeArgs = [
        "run", 
        command, 
        "--print-logs", 
        "--dangerously-skip-permissions"
      ]
      
      const result = await execInContainer(
        containerName,
        ["opencode", ...opencodeArgs],
        { cwd: workingDir, env: envVars }
      )

      // Filter and append stdout
      if (result.stdout) appendOutput(result.stdout)
      
      // Filter stderr to remove opencode's internal operational logs
      if (result.stderr) {
        const lines = result.stderr.split('\n')
        const filteredLines = lines.filter(line => {
          const trimmed = line.trim()
          if (!trimmed) return false
          // Filter out INFO/WARN/ERROR/DEBUG logs with timestamps
          if (/^(?:INFO|WARN|ERROR|DEBUG)\s+\d{4}-\d{2}-\d{2}T/i.test(trimmed)) {
            return false
          }
          return true
        })
        const filteredStr = filteredLines.join('\n')
        if (filteredStr.trim()) {
          appendOutput(filteredStr)
        }
      }

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
        logWrapper(`Failed to install OpenCode CLI: ${installCheck.error}`)
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
      
      logWrapper(`OpenCode CLI ready: ${installCheck.version} at ${installCheck.path}`)
      
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
        // Force OpenCode to output in non-TTY mode (CI environments)
        CI: "true",
      }

      // Use the full path to opencode to avoid PATH issues
      const opencodePath = installCheck.path || "opencode"
      
      // Build the args for opencode CLI - natural language command
      // opencode run "natural language description" --print-logs --dangerously-skip-permissions
      const fullArgs = [
        "run",
        command,
        "--print-logs",
        "--dangerously-skip-permissions",
      ]
      
      // Spawn WITHOUT shell to avoid shell buffering
      // Use 'pipe' for all stdio to ensure we capture everything and can send input
      const child = spawn(opencodePath, fullArgs, {
        cwd: workingDir,
        env,
        shell: false, // CRITICAL: Don't use shell - it adds buffering
        detached: false, // Keep attached so we can track output
        stdio: ['pipe', 'pipe', 'pipe'], // Allow stdin for interactive responses
      })

      running.process = child

      // Send empty line to stdin to signal opencode to proceed without hanging
      // This prevents opencode from waiting for input while keeping stdin open for interactive responses
      if (child.stdin) {
        child.stdin.write('\n')
      }

      // Handle stdout data - FLUSH IMMEDIATELY
      child.stdout?.on("data", (data) => {
        const str = data.toString()
        // Only log actual content, not internal logs
        const trimmedPreview = str.trim()
        if (trimmedPreview && !trimmedPreview.startsWith('INFO') && !trimmedPreview.startsWith('WARN') && !trimmedPreview.startsWith('DEBUG')) {
          console.log(`[opencode] ${trimmedPreview.substring(0, 80)}${trimmedPreview.length > 80 ? '...' : ''}`)
        }
        appendOutput(str)
      })

      // Handle stderr data - contains INFO/WARN logs, filter them out
      child.stderr?.on("data", (data) => {
        const str = data.toString()
        // Filter out opencode's internal operational logs before appending
        const lines = str.split('\n')
        const filteredLines = lines.filter(line => {
          const trimmed = line.trim()
          // Skip empty lines and opencode's INFO/WARN/ERROR/DEBUG logs
          if (!trimmed) return true
          if (/^(?:INFO|WARN|ERROR|DEBUG)\s+\d{4}-\d{2}-\d{2}T/i.test(trimmed)) {
            return false
          }
          return true
        })
        const filteredStr = filteredLines.join('\n')
        if (filteredStr.trim()) {
          appendOutput(filteredStr)
        }
      })
      
      // Handle process errors (spawn failures, etc)
      child.on("error", (error) => {
        console.error(`[cli-executor] Process error:`, error)
        logWrapper(`Process error: ${error.message}`)
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
    return
  }

  if (running.process) {
    const pid = running.process.pid
    
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

export function isWaitingForInput(executionId: number): boolean {
  const running = runningExecutions.get(executionId)
  return running?.waitingForInput || false
}

export function getQuestionPrompt(executionId: number): string | undefined {
  const running = runningExecutions.get(executionId)
  return running?.questionPrompt
}

export function sendInputToExecution(
  executionId: number, 
  input: string
): { success: boolean; error?: string } {
  const running = runningExecutions.get(executionId)
  
  if (!running) {
    return { 
      success: false, 
      error: "Execution not found or not running" 
    }
  }

  if (!running.process) {
    return { 
      success: false, 
      error: "No active process for this execution" 
    }
  }

  if (!running.waitingForInput) {
    console.warn(`[cli-executor] Sending input to execution ${executionId} but it's not waiting for input`)
  }

  try {
    const child = running.process
    
    if (!child.stdin || !child.stdin.writable) {
      return { 
        success: false, 
        error: "Process stdin is not available for writing" 
      }
    }

    const inputWithNewline = input.endsWith('\n') ? input : input + '\n'
    
    child.stdin.write(inputWithNewline)
    
    console.log(`[opencode] 📤 User answer sent: "${input.substring(0, 40)}..."`)
    
    running.waitingForInput = false
    running.questionPrompt = undefined
    
    return { success: true }
  } catch (error) {
    console.error(`[cli-executor] Error sending input to execution ${executionId}:`, error)
    return { 
      success: false, 
      error: `Failed to send input: ${error}` 
    }
  }
}
