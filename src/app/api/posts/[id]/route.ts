/**
 * Post Detail API Routes
 * GET /api/posts/[id]
 * PATCH /api/posts/[id]
 * DELETE /api/posts/[id]
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPostById, updatePost, deletePost, getAdjacentPosts } from '@/server/features/post'
import { auth } from '@/auth'
import { logAdminActionWithRequest, AuditAction } from '@/server/features/audit-log'
import { success, errors } from '@/lib/api-response'

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  summary: z.string().max(500).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  isPinned: z.boolean().optional(),
})

// GET /api/posts/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const post = await getPostById(params.id)

    if (!post) {
      return NextResponse.json(errors.notFound('文章不存在'))
    }

    // Get adjacent posts (prev/next) within same category
    const { prev, next } = await getAdjacentPosts(
      post.categoryId,
      post.id,
      post.publishedAt
    )

    return NextResponse.json(success({ ...post, prev, next }))
  } catch (error) {
    console.error('Failed to fetch post:', error)
    return NextResponse.json(errors.serverError('获取文章失败'))
  }
}

// PATCH /api/posts/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const body = await request.json()
    const validated = updatePostSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.title?.[0] || '数据验证失败')
      )
    }

    const post = await updatePost(params.id, validated.data)

    // Create audit log
    if (session?.user?.id) {
      const action = validated.data.status === 'PUBLISHED'
        ? AuditAction.POST_PUBLISH
        : validated.data.status === 'ARCHIVED'
        ? AuditAction.POST_ARCHIVE
        : AuditAction.POST_UPDATE

      await logAdminActionWithRequest(session.user.id, {
        action,
        target: post.title,
        details: `更新文章: ${post.title}`,
      }, request)
    }

    return NextResponse.json(success(post))
  } catch (error) {
    console.error('Failed to update post:', error)
    return NextResponse.json(errors.serverError('更新文章失败'))
  }
}

// DELETE /api/posts/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    // Get post info before delete for audit log
    const post = await getPostById(params.id)

    await deletePost(params.id)

    // Create audit log
    if (session?.user?.id && post) {
      await logAdminActionWithRequest(session.user.id, {
        action: AuditAction.POST_DELETE,
        target: post.title,
        details: `删除文章: ${post.title}`,
      }, request)
    }

    return NextResponse.json(success(null, '删除成功'))
  } catch (error) {
    console.error('Failed to delete post:', error)
    return NextResponse.json(errors.serverError('删除文章失败'))
  }
}
