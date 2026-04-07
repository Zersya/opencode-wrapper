import { notFound } from "next/navigation"
import { TaskDetail } from "@/components/tasks/task-detail"
import type { Task } from "@/lib/db/schema"

interface TaskPageProps {
  params: { id: string }
}

const mockTasks: (Task & {
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  creator?: { id: string; name: string; avatarUrl: string | null }
  project?: { id: number; name: string; slug: string }
})[] = [
  {
    id: 1,
    projectId: 1,
    title: "Implement authentication flow with Clerk",
    description: "Set up Clerk authentication with GitHub and GitLab OAuth providers. Include sign-in, sign-up, and protected routes.",
    status: "in_progress",
    priority: "high",
    position: 0,
    creatorId: "user_1",
    autoExecute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: { id: "user_1", name: "John Doe", avatarUrl: null },
    creator: { id: "user_1", name: "John Doe", avatarUrl: null },
    project: { id: 1, name: "OpenCode Wrapper", slug: "opencode-wrapper" },
  },
  {
    id: 2,
    projectId: 2,
    title: "Design kanban board components",
    description: "Create reusable kanban board, column, and task card components with drag-and-drop support.",
    status: "todo",
    priority: "medium",
    position: 0,
    creatorId: "user_1",
    autoExecute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: null,
    creator: { id: "user_1", name: "John Doe", avatarUrl: null },
    project: { id: 2, name: "Design System", slug: "design-system" },
  },
  {
    id: 3,
    projectId: 1,
    title: "Setup PostgreSQL database schema",
    description: "Define all database tables including users, organizations, projects, tasks, and executions using Drizzle ORM.",
    status: "done",
    priority: "high",
    position: 0,
    creatorId: "user_1",
    autoExecute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: { id: "user_1", name: "John Doe", avatarUrl: null },
    creator: { id: "user_1", name: "John Doe", avatarUrl: null },
    project: { id: 1, name: "OpenCode Wrapper", slug: "opencode-wrapper" },
  },
  {
    id: 4,
    projectId: 3,
    title: "Create Docker isolation for CLI execution",
    description: "Implement Docker container management for isolated opencode CLI execution per organization.",
    status: "backlog",
    priority: "urgent",
    position: 0,
    creatorId: "user_1",
    opencodeCommand: "implement docker isolation for CLI",
    autoExecute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: null,
    creator: { id: "user_1", name: "John Doe", avatarUrl: null },
    project: { id: 3, name: "API Gateway", slug: "api-gateway" },
  },
  {
    id: 5,
    projectId: 1,
    title: "Build real-time output streaming",
    description: "Implement polling-based output streaming for CLI execution with terminal-style display.",
    status: "todo",
    priority: "medium",
    position: 0,
    creatorId: "user_1",
    opencodeCommand: "implement real-time output streaming",
    autoExecute: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: null,
    creator: { id: "user_1", name: "John Doe", avatarUrl: null },
    project: { id: 1, name: "OpenCode Wrapper", slug: "opencode-wrapper" },
  },
]

export default function TaskPage({ params }: TaskPageProps) {
  const taskId = parseInt(params.id, 10)
  const task = mockTasks.find((t) => t.id === taskId)

  if (!task) {
    notFound()
  }

  return <TaskDetail task={task} />
}
