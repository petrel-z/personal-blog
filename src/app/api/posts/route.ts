/**
 * Posts API Routes
 * 只负责：解析参数、调用业务逻辑、返回响应
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPosts, createPost } from '@/server/features/post'

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
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 10

    const result = await getPosts({ page, pageSize })

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
    const body = await request.json()
    const validated = createPostSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    // TODO: 从 session 获取实际 authorId
    const authorId = 'temp-author-id'
    const post = await createPost(validated.data, authorId)

    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error) {
    console.error('Failed to create post:', error)
    return NextResponse.json(
      { success: false, error: '创建文章失败' },
      { status: 500 }
    )
  }
}
