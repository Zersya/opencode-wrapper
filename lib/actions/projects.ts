"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { projects, organizations, organizationMembers, tasks } from "@/lib/db/schema"
import { z } from "zod"

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(500).optional(),
  organizationId: z.number(),
  gitProvider: z.enum(["github", "gitlab"]).optional(),
  gitRepoUrl: z.string().url().optional(),
  gitBranch: z.string().default("main"),
})

const updateProjectSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  gitProvider: z.enum(["github", "gitlab"]).optional(),
  gitRepoUrl: z.string().url().optional().nullable(),
  gitBranch: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
})

export async function getProjects(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // Check if user is member of the organization
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership.length) {
    throw new Error("Not a member of this organization")
  }

  return db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt))
}

export async function getProjectBySlug(slug: string, organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug),
        eq(projects.organizationId, organizationId)
      )
    )
    .limit(1)

  return project || null
}

export async function getProjectWithTasks(slug: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const membership = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1)

  if (!membership.length) return null

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug),
        eq(projects.organizationId, membership[0].organizationId)
      )
    )
    .limit(1)

  if (!project) return null

  const projectTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(desc(tasks.createdAt))

  return {
    ...project,
    tasks: projectTasks,
  }
}

export async function createProject(input: z.infer<typeof createProjectSchema>) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = createProjectSchema.parse(input)

  // Check permissions
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, validated.organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership.length) {
    throw new Error("Not a member of this organization")
  }

  // Check if slug is unique within organization
  const existing = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.slug, validated.slug),
        eq(projects.organizationId, validated.organizationId)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    throw new Error("Project slug already exists in this organization")
  }

  const [project] = await db
    .insert(projects)
    .values(validated)
    .returning()

  revalidatePath("/dashboard")
  return project
}

export async function updateProject(input: z.infer<typeof updateProjectSchema>) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = updateProjectSchema.parse(input)
  const { id, ...updateData } = validated

  // Check if user has access to this project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)

  if (!project) throw new Error("Project not found")

  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership.length || !["owner", "admin"].includes(membership[0].role)) {
    throw new Error("Insufficient permissions")
  }

  const [updated] = await db
    .update(projects)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()

  revalidatePath(`/projects/${updated.slug}`)
  return updated
}

export async function deleteProject(projectId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) throw new Error("Project not found")

  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership.length || membership[0].role !== "owner") {
    throw new Error("Only owners can delete projects")
  }

  await db.delete(projects).where(eq(projects.id, projectId))

  revalidatePath("/dashboard")
}
