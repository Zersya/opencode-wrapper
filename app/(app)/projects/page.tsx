import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { Folder, ArrowRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getProjects } from "@/lib/actions/projects"
import { getCurrentOrganization } from "@/lib/actions/organizations"
import { CreateProjectForm } from "@/components/projects/create-project-form"
import { cn } from "@/lib/utils"

export default async function ProjectsPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const organization = await getCurrentOrganization()
  if (!organization) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold text-white mb-2">No Organization</h2>
          <p className="text-gray-400 mb-6">
            You need to create or join an organization to view projects.
          </p>
          <LinkButton href="/settings/organization">Create Organization</LinkButton>
        </div>
      </div>
    )
  }

  const projects = await getProjects(organization.id)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Projects</h1>
          <p className="text-gray-500">
            {projects.length} project{projects.length !== 1 ? "s" : ""} in {organization.name}
          </p>
        </div>
        <CreateProjectForm organizationId={organization.id} />
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => {
            const colors = [
              "bg-primary",
              "bg-purple-500",
              "bg-amber-500",
              "bg-green-500",
              "bg-pink-500",
              "bg-blue-500",
            ]
            const color = colors[index % colors.length]

            return (
              <Link key={project.id} href={`/projects/${project.slug}`}>
                <Card className="bg-[#1a1d21] border-gray-800 hover:border-gray-700 transition-colors group h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
                        <Folder className="h-5 w-5 text-white" />
                      </div>
                      <Badge variant="outline" className="border-gray-700">
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="text-lg font-medium text-white mb-1 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      {project.gitProvider && (
                        <Badge variant="secondary" className="bg-gray-800">
                          {project.gitProvider}
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card className="bg-[#1a1d21] border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
              <Folder className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm text-center">
              Create your first project to start managing tasks and running opencode CLI commands.
            </p>
            <CreateProjectForm
              organizationId={organization.id}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first project
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
