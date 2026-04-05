/**
 * Comments API Routes
 * 只负责：解析参数、调用业务逻辑、返回响应
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getComments, createComment } from '@/server/features/comment'

const createCommentSchema = z.object({
  nickname: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  content: z.string().min(1).max(500),
  captcha: z.string().length(4),
  postId: z.string(),
  parentId: z.string().optional(),
})

// GET /api/comments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId') || undefined
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 10

    const result = await getComments({ postId, page, pageSize })

    return NextResponse.json({
      success: true,
      data: result.comments,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return NextResponse.json(
      { success: false, error: '获取评论列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/comments
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCommentSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const comment = await createComment(validated.data)

    return NextResponse.json(
      { success: true, message: '评论提交成功，等待审核', data: comment },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create comment:', error)
    return NextResponse.json(
      { success: false, error: '评论提交失败' },
      { status: 500 }
    )
  }
}
