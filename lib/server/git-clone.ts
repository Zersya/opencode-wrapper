import { exec } from "child_process"
import { promisify } from "util"
import { db } from "@/lib/db"
import { gitIntegrations, projects, organizations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { decryptApiKey } from "./encryption"
import { execInContainer, findContainerByName } from "./docker-manager"

const execAsync = promisify(exec)

export interface CloneOptions {
  projectId: number
  workingDirectory: string
  branch?: string
  useDocker?: boolean
  containerId?: string
}

export interface CloneResult {
  success: boolean
  path: string
  error?: string
}

export async function getGitCredentials(
  organizationId: number,
  provider: "github" | "gitlab"
): Promise<{ accessToken: string } | null> {
  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.organizationId, organizationId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  if (!integration) return null

  return {
    accessToken: decryptApiKey(integration.accessToken),
  }
}

export function parseGitUrl(url: string): {
  provider: "github" | "gitlab" | "unknown"
  owner: string
  repo: string
} {
  const githubMatch = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (githubMatch) {
    return {
      provider: "github",
      owner: githubMatch[1],
      repo: githubMatch[2],
    }
  }

  const gitlabMatch = url.match(/gitlab\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (gitlabMatch) {
    return {
      provider: "gitlab",
      owner: gitlabMatch[1],
      repo: gitlabMatch[2],
    }
  }

  return { provider: "unknown", owner: "", repo: "" }
}

export function injectCredentialsIntoUrl(
  url: string,
  accessToken: string,
  provider: "github" | "gitlab"
): string {
  if (provider === "github") {
    return url.replace(
      /https:\/\/github\.com\//,
      `https://${accessToken}@github.com/`
    )
  }

  if (provider === "gitlab") {
    return url.replace(
      /https:\/\/gitlab\.com\//,
      `https://oauth2:${accessToken}@gitlab.com/`
    )
  }

  return url
}

export async function cloneRepository(
  options: CloneOptions
): Promise<CloneResult> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, options.projectId))
    .limit(1)

  if (!project) {
    return { success: false, path: "", error: "Project not found" }
  }

  if (!project.gitRepoUrl) {
    return { success: false, path: "", error: "No Git repository URL configured" }
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, project.organizationId))
    .limit(1)

  const { provider, owner, repo } = parseGitUrl(project.gitRepoUrl)
  const branch = options.branch || project.gitBranch || "main"

  let cloneUrl = project.gitRepoUrl

  if (provider !== "unknown" && org) {
    const credentials = await getGitCredentials(org.id, provider)
    if (credentials) {
      cloneUrl = injectCredentialsIntoUrl(
        project.gitRepoUrl,
        credentials.accessToken,
        provider
      )
    }
  }

  const repoName = repo || project.gitRepoUrl.split("/").pop()?.replace(/\.git$/, "") || "repo"
  const targetPath = `${options.workingDirectory}/${repoName}`

  try {
    if (options.useDocker && options.containerId) {
      return await cloneInContainer({
        containerId: options.containerId,
        cloneUrl,
        targetPath,
        branch,
        workingDirectory: options.workingDirectory,
      })
    }

    return await cloneLocally({
      cloneUrl,
      targetPath,
      branch,
      workingDirectory: options.workingDirectory,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, path: targetPath, error: errorMessage }
  }
}

interface CloneInContainerOptions {
  containerId: string
  cloneUrl: string
  targetPath: string
  branch: string
  workingDirectory: string
}

async function cloneInContainer(
  options: CloneInContainerOptions
): Promise<CloneResult> {
  const container = await findContainerByName(options.containerId)
  if (!container) {
    return { success: false, path: "", error: "Container not found" }
  }

  const mkdirResult = await execInContainer(options.containerId, [
    "mkdir",
    "-p",
    options.workingDirectory,
  ], { cwd: options.workingDirectory })

  if (mkdirResult.exitCode !== 0) {
    return { success: false, path: "", error: `Failed to create directory: ${mkdirResult.stderr}` }
  }

  const cloneResult = await execInContainer(options.containerId, [
    "git",
    "clone",
    "--branch",
    options.branch,
    "--depth",
    "1",
    options.cloneUrl,
    options.targetPath,
  ], { cwd: options.workingDirectory })

  if (cloneResult.exitCode !== 0) {
    return { success: false, path: options.targetPath, error: cloneResult.stdout }
  }

  return { success: true, path: options.targetPath }
}

interface CloneLocallyOptions {
  cloneUrl: string
  targetPath: string
  branch: string
  workingDirectory: string
}

async function cloneLocally(
  options: CloneLocallyOptions
): Promise<CloneResult> {
  try {
    await execAsync(`mkdir -p "${options.workingDirectory}"`)
  } catch {
    // Directory may already exist
  }

  const cloneCommand = `git clone --branch ${options.branch} --depth 1 "${options.cloneUrl}" "${options.targetPath}"`

  try {
    await execAsync(cloneCommand, {
      cwd: options.workingDirectory,
    })
    return { success: true, path: options.targetPath }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, path: options.targetPath, error: errorMessage }
  }
}

export async function ensureWorkspaceReady(
  projectId: number,
  organizationId: number
): Promise<{ path: string; error?: string }> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!org) {
    return { path: "", error: "Organization not found" }
  }

  const workingDirectory = `/workspace/${org.slug}`
  const useDocker = process.env.USE_DOCKER === "true"

  const containerName = `opencode-org-${org.slug}-${org.id}`
  const containerId = useDocker ? containerName : undefined

  const result = await cloneRepository({
    projectId,
    workingDirectory,
    useDocker,
    containerId,
  })

  if (!result.success && !result.error?.includes("already exists")) {
    return { path: result.path, error: result.error }
  }

  return { path: result.path }
}

export async function pullLatestChanges(
  workingDirectory: string,
  useDocker?: boolean,
  containerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (useDocker && containerId) {
      const result = await execInContainer(containerId, [
        "git",
        "pull",
        "--rebase",
      ], { cwd: workingDirectory })

      return { success: result.exitCode === 0, error: result.exitCode !== 0 ? result.stdout : undefined }
    }

    await execAsync("git pull --rebase", { cwd: workingDirectory })
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

export async function createWorktree(
  workingDirectory: string,
  branchName: string,
  targetPath: string,
  useDocker?: boolean,
  containerId?: string
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    if (useDocker && containerId) {
      const result = await execInContainer(containerId, [
        "git",
        "worktree",
        "add",
        "-b",
        branchName,
        targetPath,
      ], { cwd: workingDirectory })

      return {
        success: result.exitCode === 0,
        path: targetPath,
        error: result.exitCode !== 0 ? result.stdout : undefined,
      }
    }

    await execAsync(`git worktree add -b ${branchName} "${targetPath}"`, {
      cwd: workingDirectory,
    })
    return { success: true, path: targetPath }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, path: targetPath, error: errorMessage }
  }
}

export async function cleanupWorktree(
  workingDirectory: string,
  worktreePath: string,
  useDocker?: boolean,
  containerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (useDocker && containerId) {
      const result = await execInContainer(containerId, [
        "git",
        "worktree",
        "remove",
        "--force",
        worktreePath,
      ], { cwd: workingDirectory })

      return { success: result.exitCode === 0, error: result.exitCode !== 0 ? result.stdout : undefined }
    }

    await execAsync(`git worktree remove --force "${worktreePath}"`, {
      cwd: workingDirectory,
    })
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}
