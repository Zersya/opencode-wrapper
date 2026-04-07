"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  Search,
  Folder,
  Inbox,
  LayoutGrid,
  Settings,
  Plus,
  Users,
  Building2,
  ExternalLink,
  Keyboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const commands = [
  {
    group: "Navigation",
    items: [
      { id: "inbox", label: "Inbox", icon: Inbox, shortcut: "G I", href: "/inbox" },
      { id: "my-issues", label: "My Issues", icon: LayoutGrid, shortcut: "G M", href: "/issues" },
    ],
  },
  {
    group: "Projects",
    items: [
      { id: "project-1", label: "OpenCode Wrapper", icon: Folder, href: "/projects/opencode-wrapper" },
      { id: "project-2", label: "Design System", icon: Folder, href: "/projects/design-system" },
      { id: "project-3", label: "API Gateway", icon: Folder, href: "/projects/api-gateway" },
      { id: "new-project", label: "Create new project...", icon: Plus, href: "/projects/new" },
    ],
  },
  {
    group: "Organization",
    items: [
      { id: "team", label: "Team", icon: Users, href: "/settings/team" },
      { id: "settings", label: "Settings", icon: Settings, shortcut: "G S", href: "/settings" },
      { id: "new-org", label: "Create organization...", icon: Building2, href: "/organizations/new" },
    ],
  },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, setIsOpen])

  const runCommand = React.useCallback((command: { href?: string; action?: () => void }) => {
    setIsOpen(false)
    setSearch("")
    if (command.href) {
      router.push(command.href)
    } else if (command.action) {
      command.action()
    }
  }, [router, setIsOpen])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="overflow-hidden p-0 bg-[#1a1d21] border-gray-800 text-white max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <div className="flex items-center border-b border-gray-800 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search or type a command..."
              className="flex-1 bg-transparent py-3 text-white placeholder:text-gray-500 focus:outline-none"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-xs font-medium text-gray-400 sm:flex">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            {commands.map((group) => (
              <Command.Group key={group.group} heading={group.group} className="py-2">
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${group.group} ${item.label}`}
                    onSelect={() => runCommand({ href: item.href })}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-300 aria-selected:bg-gray-800 aria-selected:text-white cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400 sm:flex">
                        {item.shortcut.split(" ").map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-gray-600"> </span>}
                            {key}
                          </React.Fragment>
                        ))}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            <Command.Group heading="Help" className="py-2">
              <Command.Item
                value="help keyboard shortcuts"
                onSelect={() => runCommand({ href: "/shortcuts" })}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-300 aria-selected:bg-gray-800 aria-selected:text-white cursor-pointer"
              >
                <Keyboard className="h-4 w-4 text-gray-500" />
                <span className="flex-1">Keyboard shortcuts</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400 sm:flex">
                  ?
                </kbd>
              </Command.Item>
              <Command.Item
                value="help documentation"
                onSelect={() => window.open("https://docs.opencode.dev", "_blank")}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-300 aria-selected:bg-gray-800 aria-selected:text-white cursor-pointer"
              >
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <span className="flex-1">Documentation</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
