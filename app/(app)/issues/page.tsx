import Link from "next/link"
import { CheckCircle2, Clock, Play, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { LinkButton } from "@/components/ui/link-button"
import { getUserIssues } from "@/lib/actions/issues"
import { getCurrentOrganization } from "@/lib/actions/organizations"

const statusIcons = {
  backlog: Clock,
  todo: Clock,
  in_progress: Play,
  in_review: Play,
  done: CheckCircle2,
  canceled: Clock,
}

const statusColors = {
  backlog: "text-gray-500",
  todo: "text-purple-400",
  in_progress: "text-amber-400",
  in_review: "text-blue-400",
  done: "text-green-400",
  canceled: "text-gray-600",
}

const priorityColors = {
  no_priority: "bg-gray-700 text-gray-400",
  low: "bg-gray-700 text-gray-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  urgent: "bg-red-500/20 text-red-400",
}

export default async function IssuesPage() {
  const organization = await getCurrentOrganization()

  if (!organization) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">No Organization</h2>
          <p className="text-gray-400 mb-6">
            You need to create or join an organization to view issues.
          </p>
          <LinkButton href="/settings/organization">Create Organization</LinkButton>
        </div>
      </div>
    )
  }

  const issues = await getUserIssues(organization.id)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">My Issues</h1>
          <p className="text-gray-500">Issues assigned to you or created by you</p>
        </div>
        <LinkButton href="/dashboard">New Issue</LinkButton>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No issues yet. Create your first task to get started.</p>
          <LinkButton href="/dashboard">Go to Dashboard</LinkButton>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => {
            const StatusIcon = statusIcons[issue.status as keyof typeof statusIcons] || Clock
            return (
              <Link
                key={issue.id}
                href={`/tasks/${issue.id}`}
                className="flex items-center gap-4 p-4 rounded-lg bg-[#1a1d21] border border-gray-800 hover:bg-gray-800/50 transition-colors group"
              >
                <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusColors[issue.status as keyof typeof statusColors] || "text-gray-500")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">TSK-{issue.id}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">{issue.projectName}</span>
                  </div>
                  <h3 className="text-sm font-medium text-white truncate mt-1">
                    {issue.title}
                  </h3>
                </div>
                <Badge className={priorityColors[issue.priority as keyof typeof priorityColors] || "bg-gray-700 text-gray-400"}>
                  {issue.priority.replace("_", " ")}
                </Badge>
                <ArrowRight className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
