import { spawn, type ChildProcess } from "child_process"
import { ensureOpenCodeInstalled } from "./opencode-installer"

interface OpenCodeServer {
  process: ChildProcess | null
  port: number
  hostname: string
  status: "starting" | "running" | "stopped" | "crashed"
  startedAt: Date
  restartCount: number
  lastCrashAt?: Date
}

export type ServerType = "global" | `org-${number}`

declare global {
  var __opencodeServers: Map<ServerType, OpenCodeServer> | undefined
}

const servers: Map<ServerType, OpenCodeServer> = 
  globalThis.__opencodeServers || (globalThis.__opencodeServers = new Map())

// Track restart attempts to prevent infinite loops
const MAX_RESTART_ATTEMPTS = 3
const RESTART_BACKOFF_MS = 5000

function getNextPort(basePort: number): number {
  let port = basePort
  const usedPorts = Array.from(servers.values()).map(s => s.port)
  while (usedPorts.includes(port)) {
    port++
  }
  return port
}

async function isPortInUse(port: number, hostname: string): Promise<boolean> {
  // First check: TCP port binding (catches zombie processes)
  try {
    const { exec } = await import("child_process")
    const { promisify } = await import("util")
    const execAsync = promisify(exec)
    
    // Check if anything is listening on the port
    const { stdout } = await execAsync(`lsof -i :${port} -P -n 2>/dev/null || netstat -an 2>/dev/null | grep ":${port} " || ss -tln 2>/dev/null | grep ":${port} " || echo ""`)
    if (stdout.trim()) {
      console.log(`[opencode-server] Port ${port} is bound by another process`)
      return true
    }
  } catch {
    // Ignore errors from port check commands
  }
  
  // Second check: HTTP health endpoint (catches working servers)
  try {
    const response = await fetch(`http://${hostname}:${port}/global/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function ensureServerRunning(
  serverType: ServerType = "global",
  basePort: number = 4096
): Promise<{ url: string; port: number }> {
  console.log(`[opencode-server] ensureServerRunning called for ${serverType}`)
  
  const existing = servers.get(serverType)
  
  // First, check if there's already a working server on the expected port
  const expectedPort = serverType === "global" ? basePort : getNextPort(basePort)
  const hostname = "127.0.0.1"
  
  console.log(`[opencode-server] Checking if port ${expectedPort} is already in use...`)
  
  if (await isPortInUse(expectedPort, hostname)) {
    console.log(`[opencode-server] Server already running on port ${expectedPort}`)
    if (existing) {
      existing.status = "running"
      existing.port = expectedPort
      existing.hostname = hostname
    }
    return { url: `http://${hostname}:${expectedPort}`, port: expectedPort }
  }
  
  console.log(`[opencode-server] Port ${expectedPort} not in use, checking existing entries...`)
  
  // Check if we have an existing entry but it's not responding
  if (existing) {
    if (existing.status === "starting") {
      console.log(`[opencode-server] Server ${serverType} is starting, waiting...`)
      // Wait for it to finish starting (with timeout)
      let attempts = 0
      while (existing.status === "starting" && attempts < 60) {
        await new Promise(r => setTimeout(r, 1000))
        attempts++
        if (await isPortInUse(existing.port, existing.hostname)) {
          existing.status = "running"
          return { url: `http://${existing.hostname}:${existing.port}`, port: existing.port }
        }
      }
    }
    
    // Clean up dead server
    if (existing.process && !existing.process.killed && existing.process.exitCode === null) {
      try {
        existing.process.kill("SIGTERM")
      } catch {
        // Ignore
      }
    }
    servers.delete(serverType)
  }

  const installCheck = await ensureOpenCodeInstalled()
  if (!installCheck.installed) {
    throw new Error(`OpenCode CLI not installed: ${installCheck.error}`)
  }

  const port = expectedPort
  
  console.log(`[opencode-server] Starting server ${serverType} on port ${port}`)

  const server: OpenCodeServer = {
    process: null,
    port,
    hostname,
    status: "starting",
    startedAt: new Date(),
    restartCount: 0,
  }

  // Clean environment - remove NODE_ENV to prevent conflicts
  // Also remove NODE_OPTIONS to avoid conflicts with Bun
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    SHELL: process.env.SHELL,
    TMPDIR: process.env.TMPDIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    XDG_DATA_HOME: process.env.XDG_DATA_HOME,
  } as unknown as NodeJS.ProcessEnv

  const child = spawn(installCheck.path || "opencode", [
    "serve",
    "--hostname", hostname,
    "--port", String(port),
    "--print-logs",
    "--log-level", "WARN", // Reduce log noise
  ], {
    env,
    detached: false,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  server.process = child

  // Capture output for debugging
  child.stdout?.on("data", (data: Buffer) => {
    const trimmed = data.toString().trim()
    // Log important messages, filter out repetitive ones
    if (trimmed && 
        !trimmed.includes("file.watcher.updated") && 
        !trimmed.includes("service=bus type=message.part.delta") &&
        !trimmed.includes("service=bus type=message.part.updated")) {
      console.log(`[opencode-server:${port}] ${trimmed.substring(0, 300)}`)
    }
  })

  child.stderr?.on("data", (data: Buffer) => {
    const trimmed = data.toString().trim()
    if (trimmed) {
      console.error(`[opencode-server:${port}:ERR] ${trimmed.substring(0, 300)}`)
    }
  })

  child.on("error", (error: Error) => {
    console.error(`[opencode-server:${port}] Process error:`, error)
    server.status = "crashed"
    server.lastCrashAt = new Date()
  })

  child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    const duration = Date.now() - server.startedAt.getTime()
    console.error(`[opencode-server:${port}] Process exited with code ${code} (signal: ${signal}) after ${duration}ms`)
    
    if (server.status !== "stopped") {
      server.status = "crashed"
      server.lastCrashAt = new Date()
      server.restartCount++
    }
  })

  servers.set(serverType, server)

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Server startup timeout after 30s"))
    }, 30000)

    let healthCheckInterval: NodeJS.Timeout
    let startupComplete = false

    const cleanup = () => {
      clearTimeout(timeout)
      clearInterval(healthCheckInterval)
    }

    let healthCheckAttempts = 0
    
    const checkReady = async () => {
      if (startupComplete) return
      
      healthCheckAttempts++
      if (healthCheckAttempts % 5 === 0) {
        console.log(`[opencode-server] Health check attempt ${healthCheckAttempts}...`)
      }
      
      try {
        const response = await fetch(`http://${hostname}:${port}/global/health`, {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        })
        
        if (response.ok && !startupComplete) {
          startupComplete = true
          cleanup()
          server.status = "running"
          console.log(`[opencode-server] Server ready at http://${hostname}:${port} (${server.restartCount} restarts, ${healthCheckAttempts} health checks)`)
          
          // Add small delay to ensure server is fully initialized
          await new Promise(r => setTimeout(r, 1000))
          resolve()
        }
      } catch (error) {
        // Server not ready yet, keep trying
        if (healthCheckAttempts % 5 === 0) {
          console.log(`[opencode-server] Health check failed (attempt ${healthCheckAttempts}), retrying...`)
        }
      }
    }

    healthCheckInterval = setInterval(checkReady, 1000)
    // Also check immediately
    checkReady()

    child.on("exit", (code: number | null) => {
      if (!startupComplete) {
        cleanup()
        reject(new Error(`Server process exited with code ${code} during startup`))
      }
    })

    child.on("error", (err: Error) => {
      if (!startupComplete) {
        cleanup()
        reject(new Error(`Server process error: ${err.message}`))
      }
    })
  })

  return { url: `http://${hostname}:${port}`, port }
}

export function getServer(serverType: ServerType = "global"): OpenCodeServer | undefined {
  return servers.get(serverType)
}

export function stopServer(serverType: ServerType = "global"): void {
  const server = servers.get(serverType)
  if (!server) return

  console.log(`[opencode-server] Stopping server ${serverType}`)
  
  try {
    server.process?.kill("SIGTERM")
    
    setTimeout(() => {
      try {
        server.process?.kill("SIGKILL")
      } catch {
        // Already dead
      }
    }, 5000)
  } catch (error) {
    console.error(`[opencode-server] Error stopping server:`, error)
  }

  server.status = "stopped"
  servers.delete(serverType)
}

export function stopAllServers(): void {
  console.log(`[opencode-server] Stopping all servers (${servers.size} running)`)
  servers.forEach((_, key) => stopServer(key))
}

process.on("SIGTERM", () => {
  stopAllServers()
  process.exit(0)
})

process.on("SIGINT", () => {
  stopAllServers()
  process.exit(0)
})
