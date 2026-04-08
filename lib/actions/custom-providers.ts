"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { customProviders, organizations, organizationMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { encryptApiKey, decryptApiKey } from "@/lib/server/encryption"

export interface CustomProviderInput {
  name: string
  apiKey: string
  baseUrl: string
  apiFormat: "openai" | "anthropic"
  models: string[]
  isActive?: boolean
}

export interface CustomProviderOutput {
  id: number
  organizationId: number
  name: string
  baseUrl: string
  apiFormat: "openai" | "anthropic"
  models: string[]
  isActive: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return "••••••••"
  return key.slice(0, 4) + "••••••••" + key.slice(-4)
}

export async function getCustomProviders(organizationId: number): Promise<CustomProviderOutput[]> {
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

  const providers = await db
    .select({
      id: customProviders.id,
      organizationId: customProviders.organizationId,
      name: customProviders.name,
      baseUrl: customProviders.baseUrl,
      apiFormat: customProviders.apiFormat,
      models: customProviders.models,
      isActive: customProviders.isActive,
      createdAt: customProviders.createdAt,
      updatedAt: customProviders.updatedAt,
    })
    .from(customProviders)
    .where(eq(customProviders.organizationId, organizationId))

  return providers
}

export async function createCustomProvider(
  organizationId: number,
  data: CustomProviderInput
): Promise<CustomProviderOutput> {
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

  const encryptedKey = encryptApiKey(data.apiKey)

  const [provider] = await db
    .insert(customProviders)
    .values({
      organizationId,
      name: data.name,
      apiKey: encryptedKey,
      baseUrl: data.baseUrl,
      apiFormat: data.apiFormat,
      models: data.models,
      isActive: data.isActive ?? true,
    })
    .returning({
      id: customProviders.id,
      organizationId: customProviders.organizationId,
      name: customProviders.name,
      baseUrl: customProviders.baseUrl,
      apiFormat: customProviders.apiFormat,
      models: customProviders.models,
      isActive: customProviders.isActive,
      createdAt: customProviders.createdAt,
      updatedAt: customProviders.updatedAt,
    })

  revalidatePath("/settings/api-keys")
  return provider
}

export async function updateCustomProvider(
  organizationId: number,
  providerId: number,
  data: Partial<CustomProviderInput>
): Promise<CustomProviderOutput> {
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

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.apiKey !== undefined && data.apiKey.trim() !== "") {
    updateData.apiKey = encryptApiKey(data.apiKey)
  }
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
  if (data.apiFormat !== undefined) updateData.apiFormat = data.apiFormat
  if (data.models !== undefined) updateData.models = data.models
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const [provider] = await db
    .update(customProviders)
    .set(updateData)
    .where(
      and(
        eq(customProviders.id, providerId),
        eq(customProviders.organizationId, organizationId)
      )
    )
    .returning({
      id: customProviders.id,
      organizationId: customProviders.organizationId,
      name: customProviders.name,
      baseUrl: customProviders.baseUrl,
      apiFormat: customProviders.apiFormat,
      models: customProviders.models,
      isActive: customProviders.isActive,
      createdAt: customProviders.createdAt,
      updatedAt: customProviders.updatedAt,
    })

  if (!provider) {
    throw new Error("Provider not found")
  }

  revalidatePath("/settings/api-keys")
  return provider
}

export async function deleteCustomProvider(
  organizationId: number,
  providerId: number
): Promise<void> {
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

  await db
    .delete(customProviders)
    .where(
      and(
        eq(customProviders.id, providerId),
        eq(customProviders.organizationId, organizationId)
      )
    )

  revalidatePath("/settings/api-keys")
}

export async function getCustomProviderEnvVars(
  organizationId: number
): Promise<Record<string, string>> {
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

  const providers = await db
    .select()
    .from(customProviders)
    .where(
      and(
        eq(customProviders.organizationId, organizationId),
        eq(customProviders.isActive, true)
      )
    )

  const envVars: Record<string, string> = {}

  for (const provider of providers) {
    const prefix = provider.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")
    const decryptedKey = decryptApiKey(provider.apiKey)
    
    if (decryptedKey) {
      envVars[`${prefix}_API_KEY`] = decryptedKey
      envVars[`${prefix}_BASE_URL`] = provider.baseUrl
      envVars[`${prefix}_API_FORMAT`] = provider.apiFormat
      envVars[`${prefix}_MODELS`] = provider.models.join(",")
      
      // Also set standard environment variable names based on API format
      if (provider.apiFormat === "openai") {
        // For OpenAI-compatible providers, also set format-specific vars
        envVars[`${prefix}_OPENAI_API_KEY`] = decryptedKey
        envVars[`${prefix}_OPENAI_BASE_URL`] = provider.baseUrl
      } else if (provider.apiFormat === "anthropic") {
        // For Anthropic-compatible providers, also set format-specific vars
        envVars[`${prefix}_ANTHROPIC_API_KEY`] = decryptedKey
        envVars[`${prefix}_ANTHROPIC_BASE_URL`] = provider.baseUrl
      }
    }
  }

  return envVars
}
