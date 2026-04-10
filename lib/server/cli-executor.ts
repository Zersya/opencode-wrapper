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
import { type ExecutionProgress } from "@/lib/terminal/progress-types"

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
  sessionId?: string  // OpenCode API session ID for REST-based executions
  unsubscribe?: () => void  // Function to unsubscribe from SSE events
  // NEW: Progress tracking
  progress?: ExecutionProgress
  startTime: number
  lastOutputTime: number
  toolCallCount: number
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
  console.log(`[runExecution] Starting execution ${executionId} for task ${options.taskId}`)
  console.log(`[runExecution] Command: ${options.command.substring(0, 100)}...`)
  
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
      startTime: Date.now(),
      lastOutputTime: Date.now(),
      toolCallCount: 0,
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

    let appendOutput = (data: string, forceDisplay: boolean = false) => {
      outputChunks.push(data)
      running.output.push(data)
      
      const processed = processOutput(data)
      
      // Debug logging
      if (data.length > 50) {
        console.log(`[cli-executor] appendOutput: ${data.length} chars, shouldDisplay: ${processed.shouldDisplay}, type: ${processed.type}`)
      }
      
      if (forceDisplay || processed.shouldDisplay) {
        console.log(`[cli-executor] Publishing ${processed.content.length} chars to SSE`)
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
      // REST API approach - uses opencode server for isolated execution
      // This provides better isolation and works reliably in Docker/Railway/Coolify
      
      console.log(`[cli-executor] Starting REST API execution for task ${options.taskId}`)
      
      try {
        // Create OpenCode API client
        console.log(`[cli-executor] Creating OpenCode API client...`)
        const client = createOpenCodeClient("global")
        
        // Verify server is healthy before creating session
        console.log(`[cli-executor] Checking server health...`)
        const isHealthy = await client.healthCheck()
        console.log(`[cli-executor] Server health check result: ${isHealthy}`)
        
        if (!isHealthy) {
          throw new Error("OpenCode server is not responding to health checks")
        }
        
        // Create a new session for this execution (isolated context)
        console.log(`[cli-executor] Creating session...`)
        const session = await client.createSession(`Task ${options.taskId} - ${command.substring(0, 50)}`)
        running.sessionId = session.id
        
        console.log(`[cli-executor] Session created: ${session.id}`)
        logWrapper(`Created OpenCode session: ${session.id}`)
        
        // Wait a moment for session to be fully ready
        await new Promise(r => setTimeout(r, 500))
        
        // Verify session was actually created and exists
        console.log(`[cli-executor] Verifying session ${session.id} exists...`)
        const verifySession = await client.getSession(session.id)
        if (!verifySession) {
          throw new Error(`Session ${session.id} was created but cannot be verified - server may have crashed`)
        }
        console.log(`[cli-executor] Session verified: ${verifySession.id}`)
        
        // Track server health during execution
        let serverCrashed = false
        let lastEventTime = Date.now()
        let eventCount = 0
        
        // Subscribe to SSE events for real-time output and questions
        console.log(`[cli-executor] Subscribing to SSE events...`)
        const unsubscribe = await client.subscribeToEvents(
          (event: OpenCodeEvent) => {
            lastEventTime = Date.now()
            eventCount++
            
            // Log every 50 events for debugging
            if (eventCount % 50 === 0) {
              console.log(`[cli-executor] Received ${eventCount} SSE events so far`)
            }
            
            // Handle different event types
            switch (event.type) {
              case "stream.chunk":
                // Stream chunk contains partial output
                if (event.data?.text) {
                  appendOutput(event.data.text)
                }
                break
                
              case "message.part.updated":
                // Individual message part update - this is where the actual text comes in!
                // OpenCode format: event.data.properties.part.text
                const partText = event.data?.properties?.part?.text
                if (partText && typeof partText === "string") {
                  // Log first few chunks for debugging
                  if (eventCount <= 5) {
                    console.log(`[cli-executor] message.part.updated with ${partText.length} chars: "${partText.substring(0, 50)}..."`)
                  }
                  console.log(`[cli-executor] Calling appendOutput with ${partText.length} chars`)
                  appendOutput(partText, true)
                } else {
                  // Debug: log what we got
                  if (eventCount <= 10) {
                    console.log(`[cli-executor] message.part.updated but no text found in:`, JSON.stringify(event.data).substring(0, 100))
                  }
                }
                break
                
              case "message.updated":
                // Full message update - check for completion and questions
                if (event.data?.parts) {
                  const text = event.data.parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join("")
                  
                  // Check if this is a question (assistant asking user)
                  if (event.data.role === "assistant" && isQuestion(text)) {
                    running.waitingForInput = true
                    running.questionPrompt = text
                    console.log(`[opencode] ❓ Question detected: ${text.substring(0, 60)}...`)
                    
                    publishQuestion(
                      executionId,
                      text,
                      detectQuestionType(text)
                    )
                  }
                }
                break
                
              case "error":
                const errorMsg = event.data?.message || "Unknown error"
                appendOutput(`Error: ${errorMsg}`)
                console.error(`[opencode] Session error:`, errorMsg)
                // Don't mark as crashed for application-level errors
                break
                
              default:
                // Log unhandled event types for debugging
                if (eventCount <= 10) {
                  console.log(`[cli-executor] Unhandled event type: ${event.type}`)
                }
            }
          },
          (error: Error) => {
            console.error(`[opencode] SSE connection error:`, error)
            appendOutput(`Connection error: ${error.message}`)
            
            // Check if this is a server crash (not just a connection issue)
            const timeSinceLastEvent = Date.now() - lastEventTime
            if (timeSinceLastEvent > 30000 && running.status === "running") {
              console.error(`[opencode] Server appears to have crashed (no events for ${timeSinceLastEvent}ms, total events: ${eventCount})`)
              serverCrashed = true
              
              // Fail fast as requested by user
              running.status = "failed"
              appendOutput(`\n[CRITICAL] OpenCode server crashed during execution. Marking as failed.`)
            }
          }
        )
        
        console.log(`[cli-executor] SSE subscription established`)
        
        running.unsubscribe = unsubscribe
        
        // Send the command as a message to the session
        console.log(`[cli-executor] Sending command to session ${session.id}...`)
        
        try {
          const message = await client.sendMessage(
            session.id,
            command,
            {
              model: {
                providerID: "fireworks",
                modelID: "accounts/fireworks/routers/kimi-k2p5-turbo",
              },
            }
          )
          console.log(`[cli-executor] Message sent successfully, message ID: ${message.id}`)
        } catch (sendError) {
          console.error(`[cli-executor] Failed to send message:`, sendError)
          
          // Provide more helpful error messages for common issues
          if (sendError instanceof Error) {
            if (sendError.message.includes("timeout") || sendError.name === "TimeoutError") {
              throw new Error(
                `The OpenCode server timed out while processing your request. ` +
                `This may happen when the server is under heavy load or the request is complex. ` +
                `Please try again. (Session: ${session.id})`
              )
            }
            if (sendError.message.includes("Session not found")) {
              throw new Error(
                `The OpenCode session was lost. The server may have restarted. ` +
                `Please retry your execution.`
              )
            }
          }
          
          throw sendError
        }
        
        logWrapper(`Sent command to session ${session.id}`)
        
        // Wait for execution to complete
        // Track last output time to detect when agent goes idle
        let lastOutputTime = Date.now()
        let isComplete = false
        const maxDuration = 20 * 60 * 1000 // 20 minutes max
        const idleTimeout = 30 * 1000 // 30 seconds without output = idle
        
        // Monitor output to detect completion
        const checkCompletion = () => {
          const now = Date.now()
          const timeSinceLastOutput = now - lastOutputTime
          const totalDuration = now - sessionStartTime
          
          // Mark as complete if:
          // 1. We've been waiting for input (question) - user needs to respond
          // 2. No output for 30 seconds AND not waiting for input = likely done
          // 3. Total duration exceeds 20 minutes = timeout
          if (running.waitingForInput) {
            // Waiting for user input - pause but don't complete
            return false
          }
          
          if (timeSinceLastOutput > idleTimeout && totalDuration > 60000) {
            // Idle for 30s and at least 1 minute passed = complete
            console.log(`[opencode] Execution idle for ${timeSinceLastOutput}ms, marking complete`)
            return true
          }
          
          if (totalDuration > maxDuration) {
            console.log(`[opencode] Execution timeout after ${totalDuration}ms`)
            return true
          }
          
          return false
        }
        
        // Update lastOutputTime whenever we get output
        const originalAppendOutput = appendOutput
        appendOutput = (data: string, forceDisplay?: boolean) => {
          lastOutputTime = Date.now()
          originalAppendOutput(data, forceDisplay)
        }
        
        const sessionStartTime = Date.now()
        let loopCount = 0
        const NO_EVENTS_TIMEOUT = 120000 // 2 minutes with no events = assume stuck
        const NO_OUTPUT_TIMEOUT = 90000 // 1.5 minutes with no output at all = fail
        
        // Wait loop
        console.log(`[cli-executor] Starting wait loop for execution...`)
        
        while (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          loopCount++
          
          const elapsed = Date.now() - sessionStartTime
          const timeSinceLastEvent = Date.now() - lastEventTime
          const timeSinceLastOutput = Date.now() - lastOutputTime
          
          // Log every 15 seconds (every 7-8 iterations)
          if (loopCount % 7 === 0) {
            console.log(`[cli-executor] Wait loop iteration ${loopCount}, elapsed: ${elapsed}ms, events: ${eventCount}, last event: ${timeSinceLastEvent}ms ago, last output: ${timeSinceLastOutput}ms ago, waitingForInput: ${running.waitingForInput}`)
          }
          
          // Check if we've received no events for too long (SSE might be stuck)
          if (eventCount === 0 && elapsed > NO_EVENTS_TIMEOUT && !running.waitingForInput) {
            console.error(`[cli-executor] No SSE events received for ${elapsed}ms - execution appears stuck`)
            serverCrashed = true
            running.status = "failed"
            appendOutput(`\n[CRITICAL] No events received from OpenCode server for ${elapsed/1000}s. The AI model may be unresponsive or the server failed to process the message. Please check your API keys and try again.`)
            isComplete = true
            break
          }
          
          // Check if server crashed
          if (serverCrashed) {
            console.error(`[cli-executor] Aborting execution due to server crash`)
            isComplete = true
            running.status = "failed"
            break
          }
          
          // Check if session still exists (server might have restarted and lost it)
          if (running.sessionId && !running.waitingForInput) {
            try {
              const session = await client.getSession(running.sessionId)
              if (session === null) {
                console.error(`[opencode] Session ${running.sessionId} no longer exists (server restarted?)`)
                serverCrashed = true
                isComplete = true
                running.status = "failed"
                appendOutput(`\n[CRITICAL] OpenCode session lost - server may have restarted. Marking as failed.`)
                break
              }
            } catch (error) {
              // Session check failed, might be transient
              console.warn(`[opencode] Session check failed:`, error)
            }
          }
          
          isComplete = checkCompletion()
          
          if (running.status === "canceled") {
            isComplete = true
          }
        }
        
        // Clean up
        unsubscribe()
        
        // Small delay to ensure any final output is captured
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Delete the session
        try {
          await client.deleteSession(session.id)
          logWrapper(`Deleted session ${session.id}`)
          running.sessionId = undefined  // Clear to prevent double-delete
        } catch (error) {
          console.error(`[opencode] Error deleting session:`, error)
          // Don't rethrow - session might already be gone which is fine
        }
        
        // Mark as complete
        const finalStatus = running.status === "canceled" ? "canceled" : serverCrashed ? "failed" : "success"
        
        console.log(`[cli-executor] Execution ${executionId} complete with status: ${finalStatus}`)
        
        await db
          .update(taskExecutions)
          .set({
            status: finalStatus,
            output: outputChunks.join(""),
            exitCode: finalStatus === "success" ? 0 : 1,
            completedAt: new Date(),
          })
          .where(eq(taskExecutions.id, executionId))
        
        running.status = finalStatus
        publishComplete(executionId, finalStatus, finalStatus === "success" ? 0 : 1)
        
      } catch (error) {
        console.error(`[cli-executor] REST API execution failed with error:`, error)
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        appendOutput(`Execution failed: ${errorMessage}`)
        
        await db
          .update(taskExecutions)
          .set({
            status: "failed",
            output: outputChunks.join(""),
            completedAt: new Date(),
          })
          .where(eq(taskExecutions.id, executionId))
        
        running.status = "failed"
        publishError(executionId, errorMessage)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ""
    console.error(`[cli-executor] Outer execution catch for ${executionId}:`, errorMessage)
    if (errorStack) {
      console.error(`[cli-executor] Stack trace:`, errorStack)
    }

    await db
      .update(taskExecutions)
      .set({
        status: "failed",
        output: `Execution error: ${errorMessage}`,
        completedAt: new Date(),
      })
      .where(eq(taskExecutions.id, executionId))

    const running = runningExecutions.get(executionId)
    if (running) {
      running.status = "failed"
    }
    // Publish error event
    publishError(executionId, errorMessage)
  } finally {
    console.log(`[cli-executor] Cleaning up execution ${executionId}`)
    runningExecutions.delete(executionId)
  }
}

export async function stopExecution(executionId: number): Promise<void> {
  const running = runningExecutions.get(executionId)
  if (!running) {
    return
  }

  // Handle REST API session cleanup
  if (running.sessionId) {
    try {
      // Unsubscribe from events
      if (running.unsubscribe) {
        running.unsubscribe()
      }
      
      // Delete the session
      const client = createOpenCodeClient("global")
      await client.deleteSession(running.sessionId)
      console.log(`[opencode] Deleted session ${running.sessionId} on cancel`)
    } catch (error) {
      console.error(`[cli-executor] Error cleaning up session:`, error)
    }
  }

  // Handle legacy process-based execution (Docker mode)
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

export async function sendInputToExecution(
  executionId: number, 
  input: string
): Promise<{ success: boolean; error?: string }> {
  const running = runningExecutions.get(executionId)
  
  if (!running) {
    return { 
      success: false, 
      error: "Execution not found or not running" 
    }
  }

  if (!running.sessionId) {
    return { 
      success: false, 
      error: "No active OpenCode session for this execution" 
    }
  }

  if (!running.waitingForInput) {
    console.warn(`[cli-executor] Sending input to execution ${executionId} but it's not waiting for input`)
  }

  try {
    // Verify session still exists before sending
    const client = createOpenCodeClient("global")
    const session = await client.getSession(running.sessionId)
    
    if (session === null) {
      console.error(`[cli-executor] Session ${running.sessionId} not found - server may have crashed`)
      running.waitingForInput = false
      running.questionPrompt = undefined
      running.status = "failed"
      return { 
        success: false, 
        error: "Session no longer exists - the OpenCode server may have crashed. Execution marked as failed." 
      }
    }
    
    // Use REST API to send the user input as a new message
    await client.sendMessage(
      running.sessionId,
      input,
      {
        model: {
          providerID: "fireworks",
          modelID: "accounts/fireworks/routers/kimi-k2p5-turbo",
        },
      }
    )
    
    console.log(`[opencode] 📤 User answer sent: "${input.substring(0, 40)}..."`)
    
    running.waitingForInput = false
    running.questionPrompt = undefined
    
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[cli-executor] Error sending input to execution ${executionId}:`, errorMessage)
    
    // If session not found, mark execution as failed
    if (errorMessage.includes("Session not found") || errorMessage.includes("404")) {
      running.waitingForInput = false
      running.questionPrompt = undefined
      running.status = "failed"
      return { 
        success: false, 
        error: "Session no longer exists - the OpenCode server may have crashed. Execution marked as failed." 
      }
    }
    
    return { 
      success: false, 
      error: `Failed to send input: ${errorMessage}` 
    }
  }
}

// Helper function to detect if text is a question
function isQuestion(text: string): boolean {
  const questionPatterns = [
    /\?\s*$/m,  // Ends with question mark
    /(?:please\s+(?:provide|enter|input|specify))|(?:what\s+(?:is|are))|(?:how\s+(?:do|can|should|would))|(?:enter\s+(?:the|your))|(?:input:?\s*$)/i,
    /(?:choose|select|pick|option|which\s+.*\?)/i,
    /(?:proceed\?|continue\?|confirm\?|yes\/no|y\/n)/i,
  ]
  
  return questionPatterns.some(pattern => pattern.test(text))
}

// Helper function to detect question type
function detectQuestionType(text: string): "input" | "choice" | "confirmation" {
  if (/(?:proceed\?|continue\?|confirm\?|yes\/no|y\/n|are you sure)/i.test(text)) {
    return "confirmation"
  }
  
  if (/(?:choose|select|pick|option|which\s+(?:one|option|of))/i.test(text)) {
    return "choice"
  }
  
  return "input"
}
