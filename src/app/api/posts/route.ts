/**
 * Posts API Routes
 * 只负责：解析参数、调用业务逻辑、返回响应
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPosts, createPost } from '@/server/features/post'
import { auth } from '@/auth'
import { logAdminActionWithRequest, AuditAction } from '@/server/features/audit-log'

export const dynamic = 'force-dynamic'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  summary: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  coverImage: z.string().url().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  isPinned: z.boolean().optional(),
})

// GET /api/posts
// Query params: page, pageSize, status (optional - for admin), categoryId, tagSlug
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 10
    const status = searchParams.get('status') as 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'all' | null
    const categoryId = searchParams.get('categoryId') || undefined
    const tagSlug = searchParams.get('tagSlug') || undefined

    const result = await getPosts({
      page,
      pageSize,
      status: status === 'all' ? undefined : status || undefined,
      categoryId,
      tagSlug,
    })

    return NextResponse.json({
      success: true,
      data: result.posts,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return NextResponse.json(
      { success: false, error: '获取文章列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/posts
export async function POST(request: Request) {
  try {
    const session = await auth()
    const body = await request.json()
    const validated = createPostSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const authorId = session?.user?.id || 'anonymous'
    const post = await createPost(validated.data, authorId)

    // Create audit log
    if (session?.user?.id) {
      await logAdminActionWithRequest(session.user.id, {
        action: AuditAction.POST_CREATE,
        target: post.title,
        details: `创建文章: ${post.title}`,
      }, request)
    }

    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error) {
    console.error('Failed to create post:', error)
    return NextResponse.json(
      { success: false, error: '创建文章失败' },
      { status: 500 }
    )
  }
}
