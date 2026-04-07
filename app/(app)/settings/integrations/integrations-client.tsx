"use client"

import * as React from "react"
import Link from "next/link"
import {
  Settings as SettingsIcon,
  Key,
  GitBranch,
  Users,
  Building2,
  Shield,
  Check,
  RefreshCw,
  Unlink,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const settingsSections = [
  { id: "account", label: "Account", icon: Users, href: "/settings" },
  { id: "organization", label: "Organization", icon: Building2, href: "/settings/organization" },
  { id: "integrations", label: "Integrations", icon: GitBranch, href: "/settings/integrations" },
  { id: "api-keys", label: "API Keys", icon: Key, href: "/settings/api-keys" },
  { id: "security", label: "Security", icon: Shield, href: "/settings/security" },
]

interface GitIntegration {
  id: number
  provider: "github" | "gitlab"
  scope: string | null
  createdAt: Date | null
}

interface IntegrationsClientProps {
  organizationId: number
  integrations: GitIntegration[]
}

const providerConfig = {
  github: {
    name: "GitHub",
    description: "Connect to GitHub repositories for version control and pull requests",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  gitlab: {
    name: "GitLab",
    description: "Connect to GitLab repositories for version control and merge requests",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
      </svg>
    ),
  },
}

export function IntegrationsClient({ organizationId, integrations }: IntegrationsClientProps) {
  const [isConnecting, setIsConnecting] = React.useState<string | null>(null)

  const githubIntegration = integrations.find((i) => i.provider === "github")
  const gitlabIntegration = integrations.find((i) => i.provider === "gitlab")

  const handleConnect = async (provider: "github" | "gitlab") => {
    setIsConnecting(provider)
    // TODO: Implement OAuth flow
    setTimeout(() => setIsConnecting(null), 1000)
  }

  const handleDisconnect = async (integrationId: number) => {
    // TODO: Implement disconnect
  }

  const handleRefresh = async (integrationId: number) => {
    // TODO: Implement refresh
  }

  const renderIntegrationCard = (provider: "github" | "gitlab", integration?: GitIntegration) => {
    const config = providerConfig[provider]
    const isConnected = !!integration
    const scopes = integration?.scope?.split(",") || []
    const connectedAt = integration?.createdAt
      ? new Date(integration.createdAt).toLocaleDateString()
      : null

    return (
      <Card key={provider} className="bg-[#1a1d21] border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-gray-800">{config.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{config.name}</h3>
                  {isConnected ? (
                    <Badge className="bg-green-950 text-green-400 border-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-gray-700 text-gray-500">
                      Not connected
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                {isConnected && scopes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="outline"
                        className="text-xs border-gray-700 text-gray-400"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                )}
                {isConnected && connectedAt && (
                  <p className="text-xs text-gray-600 mt-2">
                    Connected on {connectedAt}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isConnected ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-gray-700"
                    onClick={() => handleRefresh(integration.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 text-red-400"
                    onClick={() => handleDisconnect(integration.id)}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm"
                  onClick={() => handleConnect(provider)}
                  disabled={isConnecting === provider}
                >
                  {isConnecting === provider && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <GitBranch className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Settings
        </h2>
        <nav className="space-y-1">
          {settingsSections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                section.id === "integrations"
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              )}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-white mb-2">Integrations</h1>
          <p className="text-gray-500 mb-8">
            Connect to external services for enhanced functionality
          </p>

          <div className="space-y-4">
            {renderIntegrationCard("github", githubIntegration)}
            {renderIntegrationCard("gitlab", gitlabIntegration)}
          </div>

          <Card className="bg-[#1a1d21] border-gray-800 mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Webhooks</CardTitle>
              <CardDescription className="text-gray-500">
                Configure webhooks for external event notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Webhook configuration coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
