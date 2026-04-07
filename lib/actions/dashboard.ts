"use server"

import { auth } from "@clerk/nextjs/server"
import { eq, and, count, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, taskExecutions, projects, organizationMembers } from "@/lib/db/schema"

export async function getDashboardStats(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // Check membership
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

  // Get active tasks count (not done or canceled)
  const activeTasksResult = await db
    .select({ count: count() })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        sql`${tasks.status} NOT IN ('done', 'canceled')`
      )
    )

  // Get completed tasks this month
  const completedThisMonth = await db
    .select({ count: count() })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(tasks.status, "done"),
        sql`EXTRACT(MONTH FROM ${tasks.completedAt}) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM ${tasks.completedAt}) = EXTRACT(YEAR FROM CURRENT_DATE)`
      )
    )

  // Get in-progress tasks
  const inProgressResult = await db
    .select({ count: count() })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(tasks.status, "in_progress")
      )
    )

  // Get executions this week
  const executionsThisWeek = await db
    .select({ count: count() })
    .from(taskExecutions)
    .where(
      and(
        eq(taskExecutions.organizationId, organizationId),
        sql`${taskExecutions.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`
      )
    )

  return {
    activeTasks: activeTasksResult[0]?.count || 0,
    completedThisMonth: completedThisMonth[0]?.count || 0,
    inProgress: inProgressResult[0]?.count || 0,
    executionsThisWeek: executionsThisWeek[0]?.count || 0,
  }
}

export async function getRecentTasks(organizationId: number, limit = 5) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(projects.organizationId, organizationId))
    .orderBy(sql`${tasks.updatedAt} DESC`)
    .limit(limit)
}

export async function getProjectSummaries(organizationId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const orgProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
    })
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .limit(5)

  const summaries = await Promise.all(
    orgProjects.map(async (project) => {
      const totalTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(eq(tasks.projectId, project.id))

      const completedTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, project.id),
            eq(tasks.status, "done")
          )
        )

      return {
        ...project,
        totalTasks: totalTasks[0]?.count || 0,
        completedTasks: completedTasks[0]?.count || 0,
      }
    })
  )

  return summaries
}
