import { getCurrentOrganization, getOrganizationMembers, createOrganizationFromForm } from "@/lib/actions/organizations"
import { OrganizationSettingsClient } from "./organization-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import Link from "next/link"

export default async function OrganizationSettingsPage() {
  const [organization, members] = await Promise.all([
    getCurrentOrganization(),
    getCurrentOrganization().then((org) => 
      org ? getOrganizationMembers(org.id) : []
    ),
  ])

  if (!organization) {
    return (
      <div className="flex h-full">
        <div className="w-64 border-r border-gray-800 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Settings
          </h2>
          <nav className="space-y-1">
            <Link
              href="/settings/organization"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-gray-800 text-white"
            >
              <Building2 className="h-4 w-4" />
              Organization
            </Link>
          </nav>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="bg-[#1a1d21] border-gray-800 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create Organization
              </CardTitle>
              <CardDescription className="text-gray-500">
                You need an organization to start managing projects and tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createOrganizationFromForm} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input 
                    id="name"
                    name="name"
                    placeholder="Acme Inc."
                    className="bg-gray-800 border-gray-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input 
                    id="slug"
                    name="slug"
                    placeholder="acme-inc"
                    className="bg-gray-800 border-gray-700"
                    required
                    pattern="[a-z0-9-]+"
                    title="Lowercase letters, numbers, and hyphens only"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input 
                    id="description"
                    name="description"
                    placeholder="A brief description"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Organization
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <OrganizationSettingsClient organization={organization} members={members} />
}
