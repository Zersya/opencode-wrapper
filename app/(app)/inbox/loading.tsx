import { Loader2 } from "lucide-react"

export default function InboxLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading inbox...</span>
      </div>
    </div>
  )
}
