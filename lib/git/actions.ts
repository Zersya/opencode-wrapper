"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { gitIntegrations, projects } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { encryptApiKey, decryptApiKey } from "@/lib/server/encryption"
import {
  getGitClient,
  getOrganizationGitClient,
  type GitProvider,
  type GitHubRepository,
  type GitLabRepository,
  type GitHubBranch,
  type GitLabBranch,
  type GitHubPullRequest,
  type GitLabMergeRequest,
} from "./api"

export interface Repository {
  id: string
  name: string
  fullName: string
  description: string | null
  url: string
  cloneUrl: string
  isPrivate: boolean
  owner: string
  defaultBranch: string
  updatedAt: Date
  stars?: number
}

export interface Branch {
  name: string
  isProtected: boolean
  sha?: string
}

export interface PullRequest {
  id: string
  number: number
  title: string
  state: "open" | "closed" | "merged"
  url: string
  body: string | null
  author: {
    name: string
    avatarUrl: string
  }
  createdAt: Date
  sourceBranch: string
  targetBranch: string
}

export async function connectGitProvider(
  provider: GitProvider,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const encryptedToken = encryptApiKey(accessToken)

  await db
    .insert(gitIntegrations)
    .values({
      userId,
      provider,
      accessToken: encryptedToken,
      refreshToken: refreshToken ? encryptApiKey(refreshToken) : null,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [gitIntegrations.userId, gitIntegrations.provider],
      set: {
        accessToken: encryptedToken,
        refreshToken: refreshToken ? encryptApiKey(refreshToken) : null,
        expiresAt,
      },
    })
}

export async function disconnectGitProvider(provider: GitProvider): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  await db
    .delete(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
}

export async function listRepositories(
  provider: GitProvider
): Promise<Repository[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  if (!integration) {
    throw new Error(`No ${provider} integration found`)
  }

  const accessToken = decryptApiKey(integration.accessToken)
  const client = await getGitClient(provider, accessToken)

  const repos = await client.getRepositories()

  if (provider === "github") {
    return (repos as GitHubRepository[]).map((repo) => ({
      id: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      isPrivate: repo.private,
      owner: repo.owner.login,
      defaultBranch: repo.default_branch,
      updatedAt: new Date(repo.updated_at),
    }))
  }

  return (repos as GitLabRepository[]).map((repo) => ({
    id: String(repo.id),
    name: repo.name,
    fullName: repo.path_with_namespace,
    description: repo.description,
    url: repo.web_url,
    cloneUrl: repo.http_url_to_repo,
    isPrivate: repo.visibility === "private",
    owner: repo.namespace.path,
    defaultBranch: repo.default_branch,
    updatedAt: new Date(repo.last_activity_at),
  }))
}

export async function listBranches(
  provider: GitProvider,
  owner: string,
  repo: string
): Promise<Branch[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  if (!integration) {
    throw new Error(`No ${provider} integration found`)
  }

  const accessToken = decryptApiKey(integration.accessToken)
  const client = await getGitClient(provider, accessToken)

  const branches = await client.getBranches(owner, repo)

  if (provider === "github") {
    return (branches as GitHubBranch[]).map((branch) => ({
      name: branch.name,
      isProtected: branch.protected,
      sha: branch.commit.sha,
    }))
  }

  return (branches as GitLabBranch[]).map((branch) => ({
    name: branch.name,
    isProtected: branch.protected,
    sha: branch.commit.id,
  }))
}

export async function listPullRequests(
  provider: GitProvider,
  owner: string,
  repo: string
): Promise<PullRequest[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  if (!integration) {
    throw new Error(`No ${provider} integration found`)
  }

  const accessToken = decryptApiKey(integration.accessToken)
  const client = await getGitClient(provider, accessToken)

  const prs = await client.getPullRequests(owner, repo)

  if (provider === "github") {
    return (prs as GitHubPullRequest[]).map((pr) => ({
      id: String(pr.id),
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      body: pr.body,
      author: {
        name: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      createdAt: new Date(pr.created_at),
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
    }))
  }

  return (prs as GitLabMergeRequest[]).map((mr) => ({
    id: String(mr.id),
    number: mr.iid,
    title: mr.title,
    state: mr.state === "merged" ? "merged" : mr.state === "closed" ? "closed" : "open",
    url: mr.web_url,
    body: mr.description,
    author: {
      name: mr.author.name,
      avatarUrl: mr.author.avatar_url,
    },
    createdAt: new Date(mr.created_at),
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
  }))
}

export async function createPullRequest(
  provider: GitProvider,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<PullRequest> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  if (!integration) {
    throw new Error(`No ${provider} integration found`)
  }

  const accessToken = decryptApiKey(integration.accessToken)
  const client = await getGitClient(provider, accessToken)

  const pr = await client.createPullRequest(owner, repo, { title, body, head, base })

  if (provider === "github") {
    const ghPr = pr as GitHubPullRequest
    return {
      id: String(ghPr.id),
      number: ghPr.number,
      title: ghPr.title,
      state: ghPr.state,
      url: ghPr.html_url,
      body: ghPr.body,
      author: {
        name: ghPr.user.login,
        avatarUrl: ghPr.user.avatar_url,
      },
      createdAt: new Date(ghPr.created_at),
      sourceBranch: ghPr.head.ref,
      targetBranch: ghPr.base.ref,
    }
  }

  const glMr = pr as GitLabMergeRequest
  return {
    id: String(glMr.id),
    number: glMr.iid,
    title: glMr.title,
    state: glMr.state === "merged" ? "merged" : glMr.state === "closed" ? "closed" : "open",
    url: glMr.web_url,
    body: glMr.description,
    author: {
      name: glMr.author.name,
      avatarUrl: glMr.author.avatar_url,
    },
    createdAt: new Date(glMr.created_at),
    sourceBranch: glMr.source_branch,
    targetBranch: glMr.target_branch,
  }
}

export async function hasGitIntegration(provider: GitProvider): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const [integration] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, provider)
      )
    )
    .limit(1)

  return !!integration
}
