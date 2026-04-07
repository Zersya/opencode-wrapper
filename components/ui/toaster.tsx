"use client"

import * as React from "react"
import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#1a1d21",
          border: "1px solid #374151",
          color: "#f7f8f8",
        },
      }}
    />
  )
}
