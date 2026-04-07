"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1a1d21] group-[.toaster]:text-white group-[.toaster]:border-gray-800 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-400",
          actionButton:
            "group-[.toast]:bg-[#5e6ad2] group-[.toast]:text-white group-[.toast]:border-[#5e6ad2]",
          cancelButton:
            "group-[.toast]:bg-gray-800 group-[.toast]:text-gray-400 group-[.toast]:border-gray-700",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
