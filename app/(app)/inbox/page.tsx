import { Inbox, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"
import { Badge } from "@/components/ui/badge"
import { getNotifications, markAllRead } from "@/lib/actions/notifications"
import { getCurrentOrganization } from "@/lib/actions/organizations"
import { formatDistanceToNow } from "date-fns"
import type { Notification } from "@/lib/db/schema"

interface NotificationData {
  taskId?: number
  projectName?: string
}

type NotificationWithData = Notification & {
  data: NotificationData | null
}

export default async function InboxPage() {
  const organization = await getCurrentOrganization()

  if (!organization) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">No Organization</h2>
          <p className="text-gray-400 mb-6">
            You need to create or join an organization to view notifications.
          </p>
          <LinkButton href="/settings/organization">Create Organization</LinkButton>
        </div>
      </div>
    )
  }

  const notifications = await getNotifications() as NotificationWithData[]
  const unreadCount = notifications.filter((n: NotificationWithData) => !n.read).length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Inbox</h1>
          <p className="text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <form action={markAllRead}>
          <Button type="submit" variant="outline" className="border-gray-700">
            Mark all as read
          </Button>
        </form>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No notifications yet</h3>
          <p className="text-gray-500">When you get notifications, they'll show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification: NotificationWithData) => {
            const data = notification.data as NotificationData | null
            return (
              <Link
                key={notification.id}
                href={data?.taskId ? `/tasks/${data.taskId}` : "#"}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border transition-colors group",
                  notification.read
                    ? "bg-[#1a1d21] border-gray-800 hover:bg-gray-800/50"
                    : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  notification.read ? "bg-gray-800" : "bg-primary/20"
                )}>
                  <Inbox className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1 truncate">
                        {notification.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {data?.projectName && (
                          <Badge variant="secondary" className="text-xs bg-gray-800 text-gray-400">
                            {data.projectName}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {notification.createdAt ? formatDistanceToNow(notification.createdAt, { addSuffix: true }) : "Just now"}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
