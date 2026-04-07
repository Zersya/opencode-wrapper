"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  LayoutGrid,
  Search,
  Settings,
  Folder,
  Plus,
  Building2,
  LogOut,
  User,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Project, Organization } from "@/lib/db/schema"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: number
}

const mainNavItems: NavItem[] = [
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "My Issues", href: "/issues", icon: LayoutGrid },
  { name: "Executions", href: "/executions", icon: Terminal },
]

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  projects: Project[]
  organizations: (Organization & { currentUserRole: string })[]
  currentOrganization: (Organization & { currentUserRole: string }) | null
}

export function Sidebar({
  className,
  collapsed = false,
  onCollapse,
  projects,
  organizations,
  currentOrganization,
}: SidebarProps) {
  const pathname = usePathname()
  const [selectedOrg, setSelectedOrg] = React.useState(
    currentOrganization || organizations[0] || null
  )
  const [projectsExpanded, setProjectsExpanded] = React.useState(true)
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

  if (!selectedOrg) {
    return (
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border w-64",
          className
        )}
      >
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No organization found</p>
            <Link
              href="/settings/organization"
              className="text-xs text-primary hover:underline mt-2 block"
            >
              Create one
            </Link>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Organization Selector */}
      <div className="p-3 border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 text-white hover:bg-gray-800",
                collapsed && "justify-center px-2"
              )}
            >
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-xs font-semibold">
                {selectedOrg.name.charAt(0)}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{selectedOrg.name}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-[#1a1d21] border-gray-800">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className="text-gray-300 focus:bg-gray-800 focus:text-white"
                onClick={() => setSelectedOrg(org)}
              >
                <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-xs mr-2">
                  {org.name.charAt(0)}
                </div>
                {org.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="p-3">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-800/50 rounded-md hover:bg-gray-800 transition-colors">
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-gray-700 rounded">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-0.5">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50",
                  collapsed && "justify-center"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </div>

        {/* Projects Section */}
        {!collapsed && (
          <div className="mt-6">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
            >
              {projectsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Projects</span>
            </button>

            {projectsExpanded && (
              <div className="mt-1 space-y-0.5">
                <Link
                  href="/projects"
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors",
                    pathname === "/projects"
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  )}
                >
                  <Folder className="h-4 w-4 text-gray-500" />
                  <span className="truncate">All Projects</span>
                </Link>

                {projects.map((project) => {
                  const isActive = pathname.startsWith(`/projects/${project.slug}`)
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.slug}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors",
                        isActive
                          ? "bg-gray-800 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                      )}
                    >
                      <Folder className="h-4 w-4 text-gray-500" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  )
                })}

                {/* Create Project Button */}
                <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-3 w-full px-3 py-1.5 text-sm text-gray-500 hover:text-white hover:bg-gray-800/50 rounded-md transition-colors">
                      <Plus className="h-4 w-4" />
                      <span>New Project</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a1d21] border-gray-800 text-white">
                    <DialogHeader>
                      <DialogTitle>Create new project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project name</Label>
                        <Input
                          id="project-name"
                          placeholder="My awesome project"
                          className="bg-gray-800 border-gray-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-url">Repository URL</Label>
                        <Input
                          id="project-url"
                          placeholder="https://github.com/org/repo"
                          className="bg-gray-800 border-gray-700"
                        />
                      </div>
                      <Button className="w-full">Create project</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex-1 justify-start gap-2 text-gray-400 hover:text-white hover:bg-gray-800">
                  <User className="h-4 w-4" />
                  <span className="truncate">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-[#1a1d21] border-gray-800">
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="text-red-400 focus:bg-gray-800 focus:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapse?.(true)}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapse?.(false)}
            className="w-full text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </Button>
        )}
      </div>
    </aside>
  )
}
