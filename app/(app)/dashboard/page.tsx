import * as React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import {
  ArrowRight,
  Folder,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getDashboardStats, getRecentTasks, getProjectSummaries } from "@/lib/actions/dashboard"
import { getCurrentOrganization } from "@/lib/actions/organizations"
import { ensureUserExists } from "@/lib/actions/users"
import { CreateProjectForm } from "@/components/projects/create-project-form"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  className?: string
}

function StatCard({ title, value, description, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("bg-[#1a1d21] border-gray-800", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-3xl font-semibold text-white">{value}</p>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
          <div className="p-2 bg-gray-800 rounded-lg">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface TaskRowProps {
  id: number
  title: string
  project: string
  projectSlug: string
  status: string
  priority: string
}

const statusColors: Record<string, string> = {
  backlog: "text-gray-500",
  todo: "text-purple-400",
  in_progress: "text-amber-400",
  in_review: "text-blue-400",
  done: "text-green-400",
  canceled: "text-gray-600",
}

const statusIcons: Record<string, React.ElementType> = {
  backlog: Clock,
  todo: Clock,
  in_progress: Play,
  in_review: Play,
  done: CheckCircle2,
  canceled: Clock,
}

const priorityColors: Record<string, string> = {
  no_priority: "bg-gray-700 text-gray-400",
  low: "bg-gray-700 text-gray-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  urgent: "bg-red-500/20 text-red-400",
}

function TaskRow({ id, title, project, projectSlug, status, priority }: TaskRowProps) {
  const StatusIcon = statusIcons[status] || Clock

  return (
    <Link
      href={`/tasks/${id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-800/50 transition-colors group"
    >
      <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusColors[status] || "text-gray-500")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-500">{project}</p>
      </div>
      <Badge variant="secondary" className={cn("text-xs", priorityColors[priority] || "bg-gray-700 text-gray-400")}>
        {priority.replace("_", " ")}
      </Badge>
      <ArrowRight className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  // Ensure user exists in database
  await ensureUserExists()

  const organization = await getCurrentOrganization()
  if (!organization) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold text-white mb-2">No Organization</h2>
          <p className="text-gray-400 mb-6">
            You need to create or join an organization to get started.
          </p>
          <LinkButton href="/settings/organization">Create Organization</LinkButton>
        </div>
      </div>
    )
  }

  const stats = await getDashboardStats(organization.id)
  const recentTasks = await getRecentTasks(organization.id, 5)
  const projects = await getProjectSummaries(organization.id)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-500">
          Overview of {organization.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Active Tasks"
          value={stats.activeTasks}
          icon={Folder}
        />
        <StatCard
          title="Completed"
          value={stats.completedThisMonth}
          description="This month"
          icon={CheckCircle2}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Play}
        />
        <StatCard
          title="Executions"
          value={stats.executionsThisWeek}
          description="CLI runs this week"
          icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#1a1d21] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-medium text-white">Recent Tasks</CardTitle>
            <LinkButton variant="ghost" size="sm" className="text-gray-400 hover:text-white" href="/issues">
              View all
            </LinkButton>
          </CardHeader>
          <CardContent className="px-2">
            {recentTasks.length > 0 ? (
              <div className="space-y-1">
                {recentTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    project={task.projectName}
                    projectSlug={task.projectSlug}
                    status={task.status}
                    priority={task.priority}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No tasks yet. Create your first task to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#1a1d21] border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CreateProjectForm
              organizationId={organization.id}
              trigger={
                <Button className="w-full justify-start gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Create new project
                </Button>
              }
            />
            <LinkButton variant="outline" className="w-full justify-start gap-2 border-gray-700 hover:bg-gray-800" href="/issues">
              <Folder className="h-4 w-4" />
              View my issues
            </LinkButton>
            <LinkButton variant="outline" className="w-full justify-start gap-2 border-gray-700 hover:bg-gray-800" href="/inbox">
              <Zap className="h-4 w-4" />
              Check notifications
            </LinkButton>

            <div className="pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-3">Shortcuts</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Command palette</span>
                  <kbd className="px-2 py-0.5 text-xs bg-gray-800 rounded text-gray-400">⌘K</kbd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Search</span>
                  <kbd className="px-2 py-0.5 text-xs bg-gray-800 rounded text-gray-400">/</kbd>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="bg-[#1a1d21] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-medium text-white">Projects</CardTitle>
            <CreateProjectForm
              organizationId={organization.id}
              trigger={
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New project
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projects.map((project, index) => {
                  const colors = ["bg-primary", "bg-purple-500", "bg-amber-500", "bg-green-500", "bg-pink-500"]
                  const color = colors[index % colors.length]
                  
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.slug}`}
                      className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
                        <Folder className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{project.name}</p>
                        <p className="text-xs text-gray-500">
                          {project.completedTasks}/{project.totalTasks} tasks
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No projects yet. Create your first project to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
