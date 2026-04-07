import { getCurrentOrganization } from "@/lib/actions/organizations"
import { ApiKeysClient } from "./api-keys-client"

export default async function ApiKeysSettingsPage() {
  const organization = await getCurrentOrganization()

  if (!organization) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">No organization found</p>
      </div>
    )
  }

  return (
    <ApiKeysClient 
      organizationId={organization.id}
      hasOpenAI={!!organization.openaiApiKey}
      hasAnthropic={!!organization.anthropicApiKey}
    />
  )
}
