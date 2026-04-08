import { FolderOpen, ArrowLeft } from "lucide-react"
import { LinkButton } from "@/components/ui/link-button"

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f1115]">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-6">
          <FolderOpen className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-3">Page not found</h2>
        <p className="text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <LinkButton href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to dashboard
        </LinkButton>
      </div>
    </div>
  )
}
