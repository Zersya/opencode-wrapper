import { decryptApiKey } from "@/lib/server/encryption"
import { db } from "@/lib/db"
import { gitIntegrations, organizations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  clone_url: string
  ssh_url: string
  private: boolean
  owner: {
    login: string
    id: number
    avatar_url: string
  }
  default_branch: string
  updated_at: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  state: "open" | "closed"
  html_url: string
  body: string | null
  user: {
    login: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
}

export interface GitLabRepository {
  id: number
  name: string
  path_with_namespace: string
  description: string | null
  web_url: string
  http_url_to_repo: string
  ssh_url_to_repo: string
  visibility: "public" | "private" | "internal"
  namespace: {
    id: number
    name: string
    path: string
  }
  default_branch: string
  last_activity_at: string
}

export interface GitLabBranch {
  name: string
  commit: {
    id: string
    short_id: string
    message: string
  }
  protected: boolean
}

export interface GitLabMergeRequest {
  id: number
  iid: number
  title: string
  state: "opened" | "closed" | "merged"
  web_url: string
  description: string | null
  author: {
    id: number
    name: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
  source_branch: string
  target_branch: string
}

export type GitProvider = "github" | "gitlab"

export interface GitClient {
  getRepositories(): Promise<GitHubRepository[] | GitLabRepository[]>
  getBranches(owner: string, repo: string): Promise<GitHubBranch[] | GitLabBranch[]>
  getPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[] | GitLabMergeRequest[]>
  createPullRequest(owner: string, repo: string, data: CreatePROptions): Promise<GitHubPullRequest | GitLabMergeRequest>
  getRepository(owner: string, repo: string): Promise<GitHubRepository | GitLabRepository | null>
}

export interface CreatePROptions {
  title: string
  body?: string
  head: string
  base: string
}

export class GitHubClient implements GitClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getRepositories(): Promise<GitHubRepository[]> {
    const repos = await this.fetch<GitHubRepository[]>("/user/repos?per_page=100&sort=updated")
    return repos
  }

  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.fetch<GitHubBranch[]>(`/repos/${owner}/${repo}/branches`)
  }

  async getPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
    return this.fetch<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=open&sort=updated`)
  }

  async createPullRequest(owner: string, repo: string, data: CreatePROptions): Promise<GitHubPullRequest> {
    return this.fetch<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        body: data.body,
        head: data.head,
        base: data.base,
      }),
    })
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
    try {
      return await this.fetch<GitHubRepository>(`/repos/${owner}/${repo}`)
    } catch {
      return null
    }
  }
}

export class GitLabClient implements GitClient {
  private accessToken: string
  private baseUrl: string

  constructor(accessToken: string, baseUrl: string = "https://gitlab.com") {
    this.accessToken = accessToken
    this.baseUrl = baseUrl
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/v4${path}`, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.accessToken,
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getRepositories(): Promise<GitLabRepository[]> {
    return this.fetch<GitLabRepository[]>("/projects?membership=true&per_page=100&order_by=updated_at")
  }

  async getBranches(owner: string, repo: string): Promise<GitLabBranch[]> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`)
    return this.fetch<GitLabBranch[]>(`/projects/${projectPath}/repository/branches`)
  }

  async getPullRequests(owner: string, repo: string): Promise<GitLabMergeRequest[]> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`)
    return this.fetch<GitLabMergeRequest[]>(`/projects/${projectPath}/merge_requests?state=opened&order_by=updated_at`)
  }

  async createPullRequest(owner: string, repo: string, data: CreatePROptions): Promise<GitLabMergeRequest> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`)
    return this.fetch<GitLabMergeRequest>(`/projects/${projectPath}/merge_requests`, {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        description: data.body,
        source_branch: data.head,
        target_branch: data.base,
      }),
    })
  }

  async getRepository(owner: string, repo: string): Promise<GitLabRepository | null> {
    try {
      const projectPath = encodeURIComponent(`${owner}/${repo}`)
      return await this.fetch<GitLabRepository>(`/projects/${projectPath}`)
    } catch {
      return null
    }
  }
}

export async function getGitClient(
  provider: GitProvider,
  accessToken: string,
  gitlabBaseUrl?: string
): Promise<GitClient> {
  if (provider === "github") {
    return new GitHubClient(accessToken)
  }
  return new GitLabClient(accessToken, gitlabBaseUrl)
}

export async function getOrganizationGitClient(
  organizationId: number,
  provider: GitProvider
): Promise<GitClient | null> {
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

  const accessToken = decryptApiKey(integration.accessToken)
  return getGitClient(provider, accessToken)
}
