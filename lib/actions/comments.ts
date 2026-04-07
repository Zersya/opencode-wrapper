"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { comments, users } from "@/lib/db/schema"
import { z } from "zod"

const createCommentSchema = z.object({
  taskId: z.number(),
  content: z.string().min(1, "Comment cannot be empty"),
})

const deleteCommentSchema = z.object({
  commentId: z.number(),
})

export type CommentWithUser = {
  id: number
  content: string
  createdAt: Date | null
  updatedAt: Date | null
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export async function getTaskComments(taskId: number): Promise<CommentWithUser[]> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const results = await db
    .select({
      comment: comments,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(desc(comments.createdAt))

  return results.map((r) => ({
    id: r.comment.id,
    content: r.comment.content,
    createdAt: r.comment.createdAt,
    updatedAt: r.comment.updatedAt,
    user: r.user,
  }))
}

export async function createComment(input: z.infer<typeof createCommentSchema>): Promise<CommentWithUser> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = createCommentSchema.parse(input)

  const [comment] = await db
    .insert(comments)
    .values({
      taskId: validated.taskId,
      userId: userId,
      content: validated.content,
    })
    .returning()

  // Get user info for the response
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  revalidatePath(`/tasks/${validated.taskId}`)

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: user || { id: userId, name: "Unknown", avatarUrl: null },
  }
}

export async function deleteComment(input: z.infer<typeof deleteCommentSchema>): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const validated = deleteCommentSchema.parse(input)

  // Verify the comment belongs to the current user
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, validated.commentId), eq(comments.userId, userId)))
    .limit(1)

  if (!comment) {
    throw new Error("Comment not found or you don't have permission to delete it")
  }

  await db.delete(comments).where(eq(comments.id, validated.commentId))

  revalidatePath(`/tasks/${comment.taskId}`)
}

export async function updateComment(commentId: number, content: string): Promise<CommentWithUser> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  if (!content.trim()) {
    throw new Error("Comment cannot be empty")
  }

  // Verify the comment belongs to the current user
  const [existingComment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)))
    .limit(1)

  if (!existingComment) {
    throw new Error("Comment not found or you don't have permission to edit it")
  }

  const [updatedComment] = await db
    .update(comments)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, commentId))
    .returning()

  // Get user info for the response
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  revalidatePath(`/tasks/${updatedComment.taskId}`)

  return {
    id: updatedComment.id,
    content: updatedComment.content,
    createdAt: updatedComment.createdAt,
    updatedAt: updatedComment.updatedAt,
    user: user || { id: userId, name: "Unknown", avatarUrl: null },
  }
}
