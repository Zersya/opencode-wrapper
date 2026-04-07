import { getCurrentUser } from "@/lib/actions/users"
import { ensureUserExists } from "@/lib/actions/users"
import { AccountSettingsClient } from "./account-client"

export default async function SettingsPage() {
  await ensureUserExists()
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">User not found</p>
      </div>
    )
  }

  return <AccountSettingsClient user={user} />
}
