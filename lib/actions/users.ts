"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return null

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user || null
}

export async function updateUser(data: { name?: string; avatarUrl?: string }) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [updated] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()

  revalidatePath("/settings")
  return updated
}

export async function ensureUserExists() {
  const { userId } = await auth()
  if (!userId) return null

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (existingUser) {
    return existingUser
  }

  const { sessionId, getToken } = await auth()
  const token = await getToken()
  
  const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch user from Clerk")
  }

  const clerkUser = await response.json()

  const email = clerkUser.email_addresses?.find(
    (e: any) => e.id === clerkUser.primary_email_address_id
  )?.email_address

  const fullName =
    [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") ||
    "User"

  const [newUser] = await db
    .insert(users)
    .values({
      id: userId,
      email: email || `${userId}@placeholder.com`,
      name: fullName,
      avatarUrl: clerkUser.image_url,
    })
    .returning()

  return newUser
}
