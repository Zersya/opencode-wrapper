import { AppLayout } from "./layout-client"
import { getProjects } from "@/lib/actions/projects"
import { getOrganizationsForUser, getCurrentOrganization } from "@/lib/actions/organizations"

export default async function AppLayoutWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [organizations, currentOrg] = await Promise.all([
    getOrganizationsForUser().catch(() => []),
    getCurrentOrganization().catch(() => null),
  ])

  const projects = currentOrg
    ? await getProjects(currentOrg.id).catch(() => [])
    : []

  return (
    <AppLayout
      projects={projects}
      organizations={organizations}
      currentOrganization={currentOrg}
      className={className}
    >
      {children}
    </AppLayout>
  )
}
