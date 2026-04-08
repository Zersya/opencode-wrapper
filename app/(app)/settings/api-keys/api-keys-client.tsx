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
  Eye,
  EyeOff,
  Check,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  X,
  Server,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateApiKeys, removeApiKey } from "@/lib/actions/organizations"
import {
  getCustomProviders,
  createCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  type CustomProviderOutput,
} from "@/lib/actions/custom-providers"

const settingsSections = [
  { id: "account", label: "Account", icon: Users, href: "/settings" },
  { id: "organization", label: "Organization", icon: Building2, href: "/settings/organization" },
  { id: "integrations", label: "Integrations", icon: GitBranch, href: "/settings/integrations" },
  { id: "api-keys", label: "API Keys", icon: Key, href: "/settings/api-keys" },
  { id: "security", label: "Security", icon: Shield, href: "/settings/security" },
]

interface ApiKeysClientProps {
  organizationId: number
  hasOpenAI: boolean
  hasAnthropic: boolean
}

interface ProviderFormData {
  name: string
  apiKey: string
  baseUrl: string
  apiFormat: "openai" | "anthropic"
  models: string[]
  isActive: boolean
}

export function ApiKeysClient({ organizationId, hasOpenAI, hasAnthropic }: ApiKeysClientProps) {
  const [showOpenAI, setShowOpenAI] = React.useState(false)
  const [showAnthropic, setShowAnthropic] = React.useState(false)
  const [openaiKey, setOpenaiKey] = React.useState("")
  const [anthropicKey, setAnthropicKey] = React.useState("")
  const [isSavingOpenAI, setIsSavingOpenAI] = React.useState(false)
  const [isSavingAnthropic, setIsSavingAnthropic] = React.useState(false)
  const [hasOpenAIState, setHasOpenAIState] = React.useState(hasOpenAI)
  const [hasAnthropicState, setHasAnthropicState] = React.useState(hasAnthropic)

  // Custom providers state
  const [customProviders, setCustomProviders] = React.useState<CustomProviderOutput[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = React.useState(true)
  const [showAddProvider, setShowAddProvider] = React.useState(false)
  const [editingProvider, setEditingProvider] = React.useState<number | null>(null)
  const [isSavingProvider, setIsSavingProvider] = React.useState(false)
  
  const [providerForm, setProviderForm] = React.useState<ProviderFormData>({
    name: "",
    apiKey: "",
    baseUrl: "",
    apiFormat: "openai",
    models: [""],
    isActive: true,
  })

  // Load custom providers on mount
  React.useEffect(() => {
    loadCustomProviders()
  }, [organizationId])

  const loadCustomProviders = async () => {
    try {
      const providers = await getCustomProviders(organizationId)
      setCustomProviders(providers)
    } catch (error) {
      console.error("Failed to load custom providers:", error)
    } finally {
      setIsLoadingProviders(false)
    }
  }

  const handleSaveOpenAI = async () => {
    if (!openaiKey) return
    setIsSavingOpenAI(true)
    try {
      await updateApiKeys(organizationId, { openaiApiKey: openaiKey })
      setHasOpenAIState(true)
      setOpenaiKey("")
    } catch (error) {
      console.error("Failed to save OpenAI key:", error)
    } finally {
      setIsSavingOpenAI(false)
    }
  }

  const handleSaveAnthropic = async () => {
    if (!anthropicKey) return
    setIsSavingAnthropic(true)
    try {
      await updateApiKeys(organizationId, { anthropicApiKey: anthropicKey })
      setHasAnthropicState(true)
      setAnthropicKey("")
    } catch (error) {
      console.error("Failed to save Anthropic key:", error)
    } finally {
      setIsSavingAnthropic(false)
    }
  }

  const handleRemoveOpenAI = async () => {
    try {
      await removeApiKey(organizationId, "openai")
      setHasOpenAIState(false)
    } catch (error) {
      console.error("Failed to remove OpenAI key:", error)
    }
  }

  const handleRemoveAnthropic = async () => {
    try {
      await removeApiKey(organizationId, "anthropic")
      setHasAnthropicState(false)
    } catch (error) {
      console.error("Failed to remove Anthropic key:", error)
    }
  }

  const handleAddModel = () => {
    setProviderForm(prev => ({
      ...prev,
      models: [...prev.models, ""]
    }))
  }

  const handleRemoveModel = (index: number) => {
    setProviderForm(prev => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index)
    }))
  }

  const handleModelChange = (index: number, value: string) => {
    setProviderForm(prev => ({
      ...prev,
      models: prev.models.map((m, i) => i === index ? value : m)
    }))
  }

  const handleCreateProvider = async () => {
    if (!providerForm.name || !providerForm.apiKey || !providerForm.baseUrl) return
    
    setIsSavingProvider(true)
    try {
      await createCustomProvider(organizationId, {
        name: providerForm.name,
        apiKey: providerForm.apiKey,
        baseUrl: providerForm.baseUrl,
        apiFormat: providerForm.apiFormat,
        models: providerForm.models.filter(m => m.trim() !== ""),
        isActive: providerForm.isActive,
      })
      
      setShowAddProvider(false)
      setProviderForm({
        name: "",
        apiKey: "",
        baseUrl: "",
        apiFormat: "openai",
        models: [""],
        isActive: true,
      })
      await loadCustomProviders()
    } catch (error) {
      console.error("Failed to create provider:", error)
    } finally {
      setIsSavingProvider(false)
    }
  }

  const handleUpdateProvider = async () => {
    if (!editingProvider || !providerForm.name || !providerForm.baseUrl) return
    
    setIsSavingProvider(true)
    try {
      await updateCustomProvider(organizationId, editingProvider, {
        name: providerForm.name,
        apiKey: providerForm.apiKey || undefined,
        baseUrl: providerForm.baseUrl,
        apiFormat: providerForm.apiFormat,
        models: providerForm.models.filter(m => m.trim() !== ""),
        isActive: providerForm.isActive,
      })
      
      setEditingProvider(null)
      setProviderForm({
        name: "",
        apiKey: "",
        baseUrl: "",
        apiFormat: "openai",
        models: [""],
        isActive: true,
      })
      await loadCustomProviders()
    } catch (error) {
      console.error("Failed to update provider:", error)
    } finally {
      setIsSavingProvider(false)
    }
  }

  const handleDeleteProvider = async (providerId: number) => {
    try {
      await deleteCustomProvider(organizationId, providerId)
      await loadCustomProviders()
    } catch (error) {
      console.error("Failed to delete provider:", error)
    }
  }

  const startEditProvider = (provider: CustomProviderOutput) => {
    setEditingProvider(provider.id)
    setProviderForm({
      name: provider.name,
      apiKey: "",
      baseUrl: provider.baseUrl,
      apiFormat: provider.apiFormat,
      models: provider.models.length > 0 ? provider.models : [""],
      isActive: provider.isActive,
    })
  }

  const cancelEdit = () => {
    setShowAddProvider(false)
    setEditingProvider(null)
    setProviderForm({
      name: "",
      apiKey: "",
      baseUrl: "",
      apiFormat: "openai",
      models: [""],
      isActive: true,
    })
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
                section.id === "api-keys"
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
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold text-white mb-2">API Keys</h1>
          <p className="text-gray-500 mb-8">
            Manage API keys for AI providers. Keys are encrypted at rest.
          </p>

          <Alert className="bg-blue-950/50 border-blue-800 mb-6">
            <Shield className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              API keys are encrypted with AES-256-GCM and never exposed in API responses or logs.
            </AlertDescription>
          </Alert>

          {/* OpenAI Section */}
          <Card className="bg-[#1a1d21] border-gray-800 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.0462 6.0462 0 0 0 6.5153 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9847 5.9847 0 0 0 3.2529-3.9777 6.0462 6.0462 0 0 0-.0026-5.9956z" />
                    </svg>
                    OpenAI API Key
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    Used for GPT-4, GPT-3.5, and embeddings
                  </CardDescription>
                </div>
                {hasOpenAIState && (
                  <Badge className="bg-green-950 text-green-400 border-green-800">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showOpenAI ? "text" : "password"}
                    placeholder={hasOpenAIState ? "••••••••••••••••" : "sk-..."}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="bg-gray-800 border-gray-700 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowOpenAI(!showOpenAI)}
                  >
                    {showOpenAI ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {hasOpenAIState && (
                  <Button 
                    variant="outline" 
                    className="border-gray-700 text-red-400"
                    onClick={handleRemoveOpenAI}
                  >
                    Remove
                  </Button>
                )}
                <Button 
                  disabled={!openaiKey || isSavingOpenAI}
                  onClick={handleSaveOpenAI}
                >
                  {isSavingOpenAI && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Anthropic Section */}
          <Card className="bg-[#1a1d21] border-gray-800 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.3048 12.2029c0-1.2578.7739-1.7756 1.5438-1.7756.7616 0 1.5232.5178 1.5232 1.7756s-.7616 1.7756-1.5232 1.7756c-.7699 0-1.5438-.5178-1.5438-1.7756zm-5.2174 0c0-1.2578.7739-1.7756 1.5232-1.7756.7699 0 1.5232.5178 1.5232 1.7756s-.7533 1.7756-1.5232 1.7756c-.7493 0-1.5232-.5178-1.5232-1.7756zm-5.2174 0c0-1.2578.7533-1.7756 1.5232-1.7756.7699 0 1.5232.5178 1.5232 1.7756s-.7533 1.7756-1.5232 1.7756c-.7699 0-1.5232-.5178-1.5232-1.7756zM12 0C5.3726 0 0 5.3726 0 12s5.3726 12 12 12 12-5.3726 12-12S18.6274 0 12 0z" />
                    </svg>
                    Anthropic API Key
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    Used for Claude models
                  </CardDescription>
                </div>
                {hasAnthropicState && (
                  <Badge className="bg-green-950 text-green-400 border-green-800">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showAnthropic ? "text" : "password"}
                    placeholder={hasAnthropicState ? "••••••••••••••••" : "sk-ant-..."}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="bg-gray-800 border-gray-700 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowAnthropic(!showAnthropic)}
                  >
                    {showAnthropic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {hasAnthropicState && (
                  <Button 
                    variant="outline" 
                    className="border-gray-700 text-red-400"
                    onClick={handleRemoveAnthropic}
                  >
                    Remove
                  </Button>
                )}
                <Button 
                  disabled={!anthropicKey || isSavingAnthropic}
                  onClick={handleSaveAnthropic}
                >
                  {isSavingAnthropic && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Custom Providers Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Custom API Providers</h2>
                <p className="text-gray-500 text-sm">Configure custom AI providers with their own base URLs and models</p>
              </div>
              <Button
                onClick={() => setShowAddProvider(true)}
                disabled={showAddProvider || editingProvider !== null}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Provider
              </Button>
            </div>

            {/* Add/Edit Provider Form */}
            {(showAddProvider || editingProvider !== null) && (
              <Card className="bg-[#1a1d21] border-gray-800 mb-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {editingProvider !== null ? "Edit Provider" : "Add Custom Provider"}
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    Configure a custom API provider with OpenAI or Anthropic-compatible format
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input
                      placeholder="e.g., My Local LLM"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Format</Label>
                      <select
                        value={providerForm.apiFormat}
                        onChange={(e) => setProviderForm(prev => ({ ...prev, apiFormat: e.target.value as "openai" | "anthropic" }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                      >
                        <option value="openai">OpenAI API Format</option>
                        <option value="anthropic">Anthropic API Format</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        value={providerForm.isActive ? "active" : "inactive"}
                        onChange={(e) => setProviderForm(prev => ({ ...prev, isActive: e.target.value === "active" }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Base URL</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={providerForm.baseUrl}
                      onChange={(e) => setProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>API Key {editingProvider !== null && "(leave blank to keep current)"}</Label>
                    <Input
                      type="password"
                      placeholder={editingProvider !== null ? "••••••••••••••••" : "sk-..."}
                      value={providerForm.apiKey}
                      onChange={(e) => setProviderForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Models</Label>
                    <div className="space-y-2">
                      {providerForm.models.map((model, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder={`Model ${index + 1} (e.g., gpt-4, claude-3-opus)`}
                            value={model}
                            onChange={(e) => handleModelChange(index, e.target.value)}
                            className="bg-gray-800 border-gray-700 flex-1"
                          />
                          {providerForm.models.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveModel(index)}
                              className="border-gray-700 text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddModel}
                      className="border-gray-700 text-gray-400"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Model
                    </Button>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      className="border-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={
                        !providerForm.name ||
                        !providerForm.baseUrl ||
                        (editingProvider === null && !providerForm.apiKey) ||
                        isSavingProvider
                      }
                      onClick={editingProvider !== null ? handleUpdateProvider : handleCreateProvider}
                    >
                      {isSavingProvider && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingProvider !== null ? (
                        <><Save className="h-4 w-4 mr-2" /> Update Provider</>
                      ) : (
                        <><Plus className="h-4 w-4 mr-2" /> Create Provider</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custom Providers List */}
            {isLoadingProviders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : customProviders.length === 0 ? (
              <Card className="bg-[#1a1d21] border-gray-800 border-dashed">
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No custom providers configured</p>
                    <p className="text-sm mt-1">Add a provider to use custom AI models</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {customProviders.map((provider) => (
                  <Card key={provider.id} className={cn(
                    "bg-[#1a1d21] border-gray-800",
                    !provider.isActive && "opacity-60"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-800 rounded-lg">
                            <Server className="h-5 w-5 text-gray-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{provider.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="border-gray-700 text-gray-400">
                                {provider.apiFormat === "openai" ? "OpenAI Format" : "Anthropic Format"}
                              </Badge>
                              {provider.isActive ? (
                                <Badge className="bg-green-950 text-green-400 border-green-800">
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-800 text-gray-400 border-gray-700">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => startEditProvider(provider)}
                            disabled={showAddProvider || editingProvider !== null}
                            className="border-gray-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteProvider(provider.id)}
                            disabled={showAddProvider || editingProvider !== null}
                            className="border-gray-700 text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Base URL:</span>
                          <code className="bg-gray-800 px-2 py-1 rounded text-gray-300 text-xs">
                            {provider.baseUrl}
                          </code>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-gray-500 text-sm">Models:</span>
                          {provider.models.map((model, idx) => (
                            <Badge key={idx} variant="outline" className="border-gray-700 text-gray-300">
                              {model}
                            </Badge>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-gray-800">
                          <p className="text-xs text-gray-500">
                            Environment variables: <code className="text-gray-400">{provider.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY</code>,{" "}
                            <code className="text-gray-400">{provider.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_BASE_URL</code>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Card className="bg-[#1a1d21] border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">Key Usage</CardTitle>
              <CardDescription className="text-gray-500">
                View usage statistics for your configured keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Configure API keys to view usage statistics</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
