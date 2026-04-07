"use client"

import * as React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { CommandPalette } from "@/components/layout/command-palette"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"
import type { Project, Organization } from "@/lib/db/schema"

interface AppLayoutProps {
  children: React.ReactNode
  className?: string
  projects: Project[]
  organizations: (Organization & { currentUserRole: string })[]
  currentOrganization: (Organization & { currentUserRole: string }) | null
}

export function AppLayout({
  children,
  className,
  projects,
  organizations,
  currentOrganization,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        projects={projects}
        organizations={organizations}
        currentOrganization={currentOrganization}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className={cn("flex-1 overflow-auto", className)}>
          {children}
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      <Toaster />
    </div>
  )
}
