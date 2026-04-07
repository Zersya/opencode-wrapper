"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
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
