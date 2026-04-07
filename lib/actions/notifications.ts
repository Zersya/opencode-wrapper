"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getNotifications(limit = 50, unreadOnly = false) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const whereClause = unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId)

  return db
    .select()
    .from(notifications)
    .where(whereClause)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount() {
  const { userId } = await auth()
  if (!userId) return 0

  const unread = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return unread.length
}

export async function markNotificationRead(notificationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  revalidatePath("/inbox")
}

export async function markAllRead() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  revalidatePath("/inbox")
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  content?: string,
  data?: Record<string, unknown>
) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      content,
      data,
    })
    .returning()

  return notification
}

export async function deleteNotification(notificationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  revalidatePath("/inbox")
}
