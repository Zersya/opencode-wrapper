import { getCurrentOrganization, getGitIntegrations } from "@/lib/actions/organizations"
import { IntegrationsClient } from "./integrations-client"

export default async function IntegrationsSettingsPage() {
  const organization = await getCurrentOrganization()

  if (!organization) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">No organization found</p>
      </div>
    )
  }

  const integrations = await getGitIntegrations(organization.id)

  return (
    <IntegrationsClient 
      organizationId={organization.id}
      integrations={integrations}
    />
  )
}
