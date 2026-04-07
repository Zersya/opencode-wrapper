"use client"

import * as React from "react"
import { Check, ChevronsUpDown, GitBranch, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { Branch } from "@/lib/git/actions"

interface BranchSelectorProps {
  branches: Branch[]
  selectedBranch?: string
  onSelect?: (branch: string) => void
  className?: string
  placeholder?: string
}

export function BranchSelector({
  branches,
  selectedBranch,
  onSelect,
  className,
  placeholder = "Select branch",
}: BranchSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search.trim()) return branches
    const query = search.toLowerCase()
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query)
    )
  }, [branches, search])

  const selected = branches.find((b) => b.name === selectedBranch)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a branch"
          className={cn("w-full justify-between border-gray-700 bg-gray-800", className)}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-gray-500" />
            {selected ? (
              <span className="truncate">
                {selected.name}
                {selected.isProtected && (
                  <Shield className="inline h-3 w-3 ml-1 text-amber-400" />
                )}
              </span>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-[#1a1d21] border-gray-800">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search branches..."
            value={search}
            onValueChange={setSearch}
            className="text-white placeholder:text-gray-500"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-gray-500">
              No branch found.
            </CommandEmpty>
            <CommandGroup className="text-gray-300">
              {filtered.map((branch) => (
                <CommandItem
                  key={branch.name}
                  value={branch.name}
                  onSelect={() => {
                    onSelect?.(branch.name)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 aria-selected:bg-gray-800"
                >
                  <GitBranch className="h-4 w-4 text-gray-500" />
                  <span className="flex-1">{branch.name}</span>
                  {branch.isProtected && (
                    <Shield className="h-3 w-3 text-amber-400" />
                  )}
                  {selectedBranch === branch.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
