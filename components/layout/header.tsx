"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useUser, useClerk } from "@clerk/nextjs"
import {
  Bell,
  Search,
  Settings,
  ChevronDown,
  FolderKanban,
  Calendar,
  Filter,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps {
  className?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function Header({ className, breadcrumbs, actions }: HeaderProps) {
  const pathname = usePathname()
  const { user, isSignedIn, isLoaded } = useUser()
  const { signOut, openSignIn } = useClerk()
  const [searchOpen, setSearchOpen] = React.useState(false)

  const getPageTitle = () => {
    if (breadcrumbs && breadcrumbs.length > 0) {
      return breadcrumbs[breadcrumbs.length - 1].label
    }
    
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return "Home"
    
    const lastSegment = segments[segments.length - 1]
    return lastSegment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const userDisplayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || "User"
  const userEmail = user?.primaryEmailAddress?.emailAddress || ""
  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}` 
    : user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "U"

  return (
    <header
      className={cn(
        "h-14 flex items-center justify-between px-6 border-b border-gray-800 bg-background",
        className
      )}
    >
      {/* Left: Breadcrumbs / Title */}
      <div className="flex items-center gap-3">
        {breadcrumbs ? (
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-gray-600">/</span>}
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? "text-white font-medium" : "text-gray-400"}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <h1 className="text-lg font-semibold text-white">{getPageTitle()}</h1>
        )}

        {/* Page Actions (optional) */}
        {actions}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* View Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
              <FolderKanban className="h-4 w-4" />
              <span>Board</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-[#1a1d21] border-gray-800">
            <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
              <FolderKanban className="mr-2 h-4 w-4" />
              Board
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
              <Calendar className="mr-2 h-4 w-4" />
              Timeline
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
              <Filter className="mr-2 h-4 w-4" />
              List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter */}
        <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
          <Filter className="h-4 w-4" />
          <span>Filter</span>
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-800" />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-gray-400 hover:text-white">
              <Avatar className="h-7 w-7">
                {isSignedIn && user?.imageUrl && (
                  <AvatarImage src={user.imageUrl} />
                )}
                <AvatarFallback className="bg-primary text-xs">
                  {isSignedIn ? userInitials : "?"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#1a1d21] border-gray-800">
            {isSignedIn ? (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">{userDisplayName}</p>
                  <p className="text-xs text-gray-500">{userEmail}</p>
                </div>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-gray-300 focus:bg-gray-800 focus:text-white">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem 
                  className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
                  onClick={() => signOut({ redirectUrl: '/' })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem 
                className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
                onClick={() => openSignIn()}
              >
                Sign in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
