import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const OPENCODE_PACKAGE = "@anthropic/opencode"

export async function isOpenCodeInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("which opencode")
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function getOpenCodePath(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("which opencode")
    return stdout.trim() || null
  } catch {
    // Try common npm global paths
    const commonPaths = [
      "/usr/local/bin/opencode",
      "/usr/bin/opencode",
      "/opt/homebrew/bin/opencode",
      `${process.env.HOME}/.npm-global/bin/opencode`,
      `${process.env.HOME}/.nvm/versions/node/*/bin/opencode`,
    ]
    
    for (const path of commonPaths) {
      try {
        await execAsync(`test -x "${path}"`)
        return path
      } catch {
        // Continue to next path
      }
    }
    
    return null
  }
}

export async function getOpenCodeVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("opencode --version")
    return stdout.trim()
  } catch {
    return null
  }
}

export async function installOpenCode(): Promise<{ success: boolean; error?: string }> {
  console.log("[opencode-installer] Installing OpenCode CLI...")
  
  try {
    const { stdout, stderr } = await execAsync(`npm install -g ${OPENCODE_PACKAGE}`)
    
    if (stderr && !stderr.includes("npm WARN")) {
      console.error("[opencode-installer] Install warnings:", stderr)
    }
    
    console.log("[opencode-installer] Install output:", stdout)
    
    // Verify installation
    const installed = await isOpenCodeInstalled()
    if (installed) {
      const version = await getOpenCodeVersion()
      console.log(`[opencode-installer] OpenCode CLI installed successfully: ${version}`)
      return { success: true }
    } else {
      return { success: false, error: "Installation appeared successful but opencode command not found in PATH" }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[opencode-installer] Installation failed:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function ensureOpenCodeInstalled(): Promise<{
  installed: boolean
  version?: string
  path?: string
  error?: string
}> {
  console.log("[opencode-installer] Checking OpenCode CLI installation...")
  
  const isInstalled = await isOpenCodeInstalled()
  
  if (isInstalled) {
    const version = await getOpenCodeVersion()
    const path = await getOpenCodePath()
    console.log(`[opencode-installer] OpenCode CLI found: ${version} at ${path}`)
    return { installed: true, version: version || undefined, path: path || undefined }
  }
  
  console.log("[opencode-installer] OpenCode CLI not found, attempting installation...")
  
  const installResult = await installOpenCode()
  
  if (installResult.success) {
    const version = await getOpenCodeVersion()
    const path = await getOpenCodePath()
    return { installed: true, version: version || undefined, path: path || undefined }
  }
  
  return { 
    installed: false, 
    error: installResult.error || "Failed to install OpenCode CLI"
  }
}
