import { exec } from "child_process"
import { promisify } from "util"
import { existsSync, mkdirSync } from "fs"
import { join } from "path"

const execAsync = promisify(exec)

// Base workspace directory - configurable via environment
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || 
  (process.env.NODE_ENV === 'production' 
    ? '/workspace'  // Production: use absolute path
    : join(process.cwd(), '.workspace'))  // Local dev: use project directory

export function getWorkspaceBase(): string {
  return WORKSPACE_BASE
}

export function getOrganizationWorkspacePath(orgSlug: string): string {
  return join(WORKSPACE_BASE, orgSlug)
}

export function ensureWorkspaceExists(orgSlug: string): string {
  const workspacePath = getOrganizationWorkspacePath(orgSlug)
  
  if (!existsSync(workspacePath)) {
    try {
      mkdirSync(workspacePath, { recursive: true })
      console.log(`[workspace] Created: ${workspacePath}`)
    } catch (error) {
      console.error(`[workspace] Failed to create ${workspacePath}:`, error)
      throw new Error(`Failed to create workspace directory: ${workspacePath}`)
    }
  }
  
  return workspacePath
}

export async function ensureWorkspaceExistsAsync(orgSlug: string): Promise<string> {
  const workspacePath = getOrganizationWorkspacePath(orgSlug)
  
  if (!existsSync(workspacePath)) {
    try {
      await execAsync(`mkdir -p "${workspacePath}"`)
      console.log(`[workspace] Created: ${workspacePath}`)
    } catch (error) {
      console.error(`[workspace] Failed to create ${workspacePath}:`, error)
      throw new Error(`Failed to create workspace directory: ${workspacePath}`)
    }
  }
  
  return workspacePath
}

export function isWorkspaceReady(orgSlug: string): boolean {
  const workspacePath = getOrganizationWorkspacePath(orgSlug)
  return existsSync(workspacePath)
}

export async function cleanupWorkspace(orgSlug: string): Promise<void> {
  const workspacePath = getOrganizationWorkspacePath(orgSlug)
  
  try {
    await execAsync(`rm -rf "${workspacePath}"`)
    console.log(`[workspace] Cleaned up: ${workspacePath}`)
  } catch (error) {
    console.error(`[workspace] Failed to cleanup ${workspacePath}:`, error)
  }
}
