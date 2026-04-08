"use client"

import { useEffect } from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body className="bg-[#0f1115] text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md p-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">Something went wrong</h2>
            <p className="text-sm text-gray-400 mb-8">
              We&apos;ve encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>
            <div className="flex items-center justify-center gap-3">
              <LinkButton variant="outline" href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go home
              </LinkButton>
              <Button onClick={reset}>Try again</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
