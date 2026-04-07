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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@/lib/db/schema"

const settingsSections = [
  { id: "account", label: "Account", icon: Users, href: "/settings" },
  { id: "organization", label: "Organization", icon: Building2, href: "/settings/organization" },
  { id: "integrations", label: "Integrations", icon: GitBranch, href: "/settings/integrations" },
  { id: "api-keys", label: "API Keys", icon: Key, href: "/settings/api-keys" },
  { id: "security", label: "Security", icon: Shield, href: "/settings/security" },
]

interface AccountSettingsClientProps {
  user: User
}

export function AccountSettingsClient({ user }: AccountSettingsClientProps) {
  const [name, setName] = React.useState(user.name)
  const [email] = React.useState(user.email)

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

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
                section.id === "account"
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
          <h1 className="text-2xl font-semibold text-white mb-2">Account</h1>
          <p className="text-gray-500 mb-8">
            Manage your account settings and preferences
          </p>

          <Card className="bg-[#1a1d21] border-gray-800 mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Profile</CardTitle>
              <CardDescription className="text-gray-500">
                Your public profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Button variant="outline" size="sm" className="border-gray-700">
                    Change avatar
                  </Button>
                </div>
              </div>
              <Separator className="bg-gray-800" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-800 border-gray-700" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={email} 
                    disabled 
                    className="bg-gray-800 border-gray-700 opacity-50" 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1d21] border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">Preferences</CardTitle>
              <CardDescription className="text-gray-500">
                Customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Email notifications</p>
                  <p className="text-xs text-gray-500">Receive email notifications for task updates</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Desktop notifications</p>
                  <p className="text-xs text-gray-500">Receive desktop notifications</p>
                </div>
                <input type="checkbox" className="toggle" />
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Auto-execute notifications</p>
                  <p className="text-xs text-gray-500">Get notified when auto-executed tasks complete</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
