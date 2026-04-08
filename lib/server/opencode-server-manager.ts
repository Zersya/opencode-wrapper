import { spawn, type ChildProcess } from "child_process"
import { ensureOpenCodeInstalled } from "./opencode-installer"

interface OpenCodeServer {
  process: ChildProcess
  port: number
  hostname: string
  status: "starting" | "running" | "stopped"
  startedAt: Date
}

type ServerType = "global" | `org-${number}`

declare global {
  var __opencodeServers: Map<ServerType, OpenCodeServer> | undefined
}

const servers: Map<ServerType, OpenCodeServer> = 
  globalThis.__opencodeServers || (globalThis.__opencodeServers = new Map())

function getNextPort(basePort: number): number {
  let port = basePort
  const usedPorts = Array.from(servers.values()).map(s => s.port)
  while (usedPorts.includes(port)) {
    port++
  }
  return port
}

export async function ensureServerRunning(
  serverType: ServerType = "global",
  basePort: number = 4096
): Promise<{ url: string; port: number }> {
  const existing = servers.get(serverType)
  
  if (existing && existing.status === "running") {
    return { 
      url: `http://${existing.hostname}:${existing.port}`, 
      port: existing.port 
    }
  }

  const installCheck = await ensureOpenCodeInstalled()
  if (!installCheck.installed) {
    throw new Error(`OpenCode CLI not installed: ${installCheck.error}`)
  }

  const port = serverType === "global" 
    ? basePort 
    : getNextPort(basePort)
  
  const hostname = "127.0.0.1"
  
  console.log(`[opencode-server] Starting server ${serverType} on port ${port}`)

  const server: OpenCodeServer = {
    process: null as any,
    port,
    hostname,
    status: "starting",
    startedAt: new Date(),
  }

  const env = {
    ...process.env,
    NODE_ENV: undefined,
  }

  const child = spawn(installCheck.path || "opencode", [
    "serve",
    "--hostname", hostname,
    "--port", String(port),
  ], {
    env,
    detached: false,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  server.process = child

  child.stdout?.on("data", (data) => {
    console.log(`[opencode-server:${port}] ${data.toString().trim()}`)
  })

  child.stderr?.on("data", (data) => {
    console.error(`[opencode-server:${port}:ERR] ${data.toString().trim()}`)
  })

  child.on("error", (error) => {
    console.error(`[opencode-server:${port}] Process error:`, error)
    server.status = "stopped"
  })

  child.on("exit", (code) => {
    console.log(`[opencode-server:${port}] Process exited with code ${code}`)
    server.status = "stopped"
  })

  servers.set(serverType, server)

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout"))
    }, 30000)

    const checkReady = async () => {
      try {
        const response = await fetch(`http://${hostname}:${port}/global/health`, {
          method: "GET",
        })
        
        if (response.ok) {
          clearTimeout(timeout)
          server.status = "running"
          console.log(`[opencode-server] Server ready at http://${hostname}:${port}`)
          resolve()
        }
      } catch (error) {
        // Server not ready yet, retry
      }
    }

    const interval = setInterval(checkReady, 500)
    
    const cleanup = () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }

    child.on("exit", () => {
      cleanup()
      reject(new Error("Server process exited during startup"))
    })

    child.on("error", () => {
      cleanup()
      reject(new Error("Server process error during startup"))
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
    server.process.kill("SIGTERM")
    
    setTimeout(() => {
      try {
        server.process.kill("SIGKILL")
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
