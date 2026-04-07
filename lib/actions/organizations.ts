"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { organizations, organizationMembers, users, gitIntegrations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { encryptApiKey, hashApiKey } from "@/lib/server/encryption"
import { ensureUserExists } from "./users"

export async function getCurrentOrganization() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const membership = await db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId))
    .limit(1)

  if (!membership.length) return null

  return {
    ...membership[0].organization,
    currentUserRole: membership[0].role,
  }
}

export async function getOrganizationsForUser() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const memberships = await db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId))

  return memberships.map((m) => ({
    ...m.organization,
    currentUserRole: m.role,
  }))
}

export async function getOrganizationMembers(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const members = await db
    .select({
      id: organizationMembers.id,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      user: users,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId))

  return members
}

export async function createOrganization(name: string, slug: string, description?: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // Ensure user exists in database before creating organization
  await ensureUserExists()

  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)

  if (existing.length > 0) {
    throw new Error("Organization slug already exists")
  }

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      description,
      ownerId: userId,
    })
    .returning()

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId,
    role: "owner",
  })

  revalidatePath("/")
  return organization
}

export async function createOrganizationFromForm(formData: FormData) {
  const name = formData.get("name") as string
  const slug = formData.get("slug") as string
  const description = formData.get("description") as string | undefined

  if (!name || !slug) {
    throw new Error("Name and slug are required")
  }

  // Convert empty string to undefined
  const normalizedDescription = description && description.trim() !== "" ? description : undefined

  return createOrganization(name, slug, normalizedDescription)
}

export async function updateOrganization(
  organizationId: number,
  data: { name?: string; description?: string }
) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length || !["owner", "admin"].includes(member[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning()

  revalidatePath("/")
  return updated
}

export async function updateApiKeys(
  organizationId: number,
  data: { openaiApiKey?: string; anthropicApiKey?: string }
) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length || !["owner", "admin"].includes(member[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const updateData: Record<string, string | undefined> = {}
  
  if (data.openaiApiKey !== undefined) {
    updateData.openaiApiKey = encryptApiKey(data.openaiApiKey)
  }
  if (data.anthropicApiKey !== undefined) {
    updateData.anthropicApiKey = encryptApiKey(data.anthropicApiKey)
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning()

  revalidatePath("/settings/api-keys")
  return {
    openaiKeySet: !!updateData.openaiApiKey,
    anthropicKeySet: !!updateData.anthropicApiKey,
  }
}

export async function removeApiKey(organizationId: number, keyType: "openai" | "anthropic") {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length || !["owner", "admin"].includes(member[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const updateField = keyType === "openai" ? "openaiApiKey" : "anthropicApiKey"

  await db
    .update(organizations)
    .set({
      [updateField]: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))

  revalidatePath("/settings/api-keys")
}

export async function inviteMember(organizationId: number, email: string, role: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length || !["owner", "admin"].includes(member[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user) {
    throw new Error("User not found. They must sign up first.")
  }

  const existing = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, user.id)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    throw new Error("User is already a member")
  }

  const [newMember] = await db
    .insert(organizationMembers)
    .values({
      organizationId,
      userId: user.id,
      role: role as "owner" | "admin" | "member",
    })
    .returning()

  revalidatePath("/settings/organization")
  return newMember
}

export async function updateMemberRole(
  organizationId: number,
  memberId: number,
  newRole: string
) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length || member[0].role !== "owner") {
    throw new Error("Only owners can change member roles")
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({ role: newRole as "owner" | "admin" | "member" })
    .where(eq(organizationMembers.id, memberId))
    .returning()

  revalidatePath("/settings/organization")
  return updated
}

export async function removeMember(organizationId: number, memberId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const currentMember = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!currentMember.length || !["owner", "admin"].includes(currentMember[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const memberToRemove = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .limit(1)

  if (!memberToRemove.length) {
    throw new Error("Member not found")
  }

  if (memberToRemove[0].role === "owner") {
    throw new Error("Cannot remove the owner")
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId))

  revalidatePath("/settings/organization")
}

export async function leaveOrganization(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length) {
    throw new Error("Not a member of this organization")
  }

  if (member[0].role === "owner") {
    const otherMembers = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))

    if (otherMembers.length > 1) {
      throw new Error("Owners must transfer ownership before leaving")
    }

    await db.delete(organizations).where(eq(organizations.id, organizationId))
  } else {
    await db.delete(organizationMembers).where(eq(organizationMembers.id, member[0].id))
  }

  revalidatePath("/")
}

export async function getGitIntegrations(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!member.length) {
    throw new Error("Not a member of this organization")
  }

  const integrations = await db
    .select({
      id: gitIntegrations.id,
      provider: gitIntegrations.provider,
      scope: gitIntegrations.scope,
      createdAt: gitIntegrations.createdAt,
    })
    .from(gitIntegrations)
    .where(eq(gitIntegrations.organizationId, organizationId))

  return integrations
}
