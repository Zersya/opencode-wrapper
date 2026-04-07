"use server"

import { auth } from "@clerk/nextjs/server"
import { eq, and, or, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, projects, users, organizationMembers } from "@/lib/db/schema"

export async function getUserIssues(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

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

  const issues = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      projectName: projects.name,
      projectSlug: projects.slug,
      assigneeId: tasks.assigneeId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        or(eq(tasks.assigneeId, userId), eq(tasks.creatorId, userId))
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(50)

  return issues
}
