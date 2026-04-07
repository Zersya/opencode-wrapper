import { notFound } from "next/navigation"
import { getProjectWithTasks } from "@/lib/actions/projects"
import { ProjectClient } from "./project-client"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await getProjectWithTasks(slug)

  if (!project) {
    notFound()
  }

  return <ProjectClient project={project} />
}
