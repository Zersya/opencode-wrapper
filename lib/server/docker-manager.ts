import Docker from "dockerode"
import type { Container, ContainerCreateOptions, ContainerInfo } from "dockerode"

const docker = new Docker()

export interface OrgContainer {
  id: string
  name: string
  organizationId: number
  status: "running" | "stopped" | "creating" | "error"
  workingDirectory: string
  createdAt: Date
}

const WORKSPACE_BASE = "/workspace"
const IMAGE_NAME = "opencode-runner:latest"

export async function buildRunnerImage(): Promise<void> {
  const dockerfile = `
FROM node:20-alpine

RUN apk add --no-cache \
  git \
  curl \
  bash \
  python3 \
  make \
  g++

RUN npm install -g pnpm

WORKDIR /workspace

CMD ["sleep", "infinity"]
`

  const stream = await docker.buildImage(
    { context: ".", dockerfile: dockerfile } as unknown as string,
    { t: IMAGE_NAME }
  )

  return new Promise((resolve, reject) => {
    stream.on("end", resolve)
    stream.on("error", reject)
  })
}

export async function createOrgContainer(
  organizationId: number,
  orgSlug: string,
  envVars: Record<string, string> = {}
): Promise<OrgContainer> {
  const containerName = `opencode-org-${orgSlug}-${organizationId}`
  const workingDir = `${WORKSPACE_BASE}/${orgSlug}`

  const existing = await findContainerByName(containerName)
  if (existing) {
    const info = await existing.inspect()
    if (info.State.Running) {
      return {
        id: existing.id,
        name: containerName,
        organizationId,
        status: "running",
        workingDirectory: workingDir,
        createdAt: new Date(info.Created),
      }
    }
    await existing.start()
    return {
      id: existing.id,
      name: containerName,
      organizationId,
      status: "running",
      workingDirectory: workingDir,
      createdAt: new Date(info.Created),
    }
  }

  const env = Object.entries(envVars)
    .filter(([_, value]) => value && value.trim() !== "")
    .map(([key, value]) => `${key}=${value}`)

  const options: ContainerCreateOptions = {
    Image: IMAGE_NAME,
    name: containerName,
    Env: env,
    WorkingDir: workingDir,
    Tty: true,
    OpenStdin: true,
    HostConfig: {
      Binds: [
        `${workingDir}:${workingDir}`,
        "/var/run/docker.sock:/var/run/docker.sock",
      ],
      Memory: 1024 * 1024 * 1024,
      CpuShares: 512,
      AutoRemove: false,
    },
    Labels: {
      "opencode.org.id": String(organizationId),
      "opencode.org.slug": orgSlug,
      "opencode.managed": "true",
    },
  }

  try {
    const container = await docker.createContainer(options)
    await container.start()

    const exec = await container.exec({
      Cmd: ["mkdir", "-p", workingDir],
      AttachStdout: true,
      AttachStderr: true,
    })
    await exec.start({ Detach: true })

    return {
      id: container.id,
      name: containerName,
      organizationId,
      status: "running",
      workingDirectory: workingDir,
      createdAt: new Date(),
    }
  } catch (error) {
    console.error("Failed to create container:", error)
    throw error
  }
}

export async function findContainerByName(name: string): Promise<Container | null> {
  const containers = await docker.listContainers({ all: true })
  const match = containers.find((c) => c.Names.includes(`/${name}`))
  return match ? docker.getContainer(match.Id) : null
}

export async function getContainer(containerId: string): Promise<Container | null> {
  try {
    return docker.getContainer(containerId)
  } catch {
    return null
  }
}

export async function stopContainer(containerId: string): Promise<void> {
  const container = await getContainer(containerId)
  if (container) {
    await container.stop()
  }
}

export async function removeContainer(containerId: string): Promise<void> {
  const container = await getContainer(containerId)
  if (container) {
    await container.remove({ force: true })
  }
}

export async function listOrgContainers(): Promise<OrgContainer[]> {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ["opencode.managed=true"],
    },
  })

  return containers.map((c) => ({
    id: c.Id,
    name: c.Names[0]?.replace("/", "") || "",
    organizationId: parseInt(c.Labels?.["opencode.org.id"] || "0"),
    status: c.State === "running" ? "running" : "stopped",
    workingDirectory: c.Labels?.["opencode.org.workdir"] || "",
    createdAt: new Date(c.Created * 1000),
  }))
}

export async function execInContainer(
  containerId: string,
  command: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const container = await getContainer(containerId)
  if (!container) {
    throw new Error(`Container ${containerId} not found`)
  }

  const exec = await container.exec({
    Cmd: command,
    WorkingDir: options.cwd,
    Env: options.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : undefined,
    AttachStdout: true,
    AttachStderr: true,
  })

  const stream = await exec.start({ Detach: false })

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let stdout = ""
    let stderr = ""

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })

    stream.on("end", async () => {
      const output = Buffer.concat(chunks).toString("utf8")
      const info = await exec.inspect()

      resolve({
        stdout: output,
        stderr: "",
        exitCode: info.ExitCode || 0,
      })
    })

    stream.on("error", reject)
  })
}

export async function healthCheck(): Promise<boolean> {
  try {
    await docker.ping()
    return true
  } catch {
    return false
  }
}
