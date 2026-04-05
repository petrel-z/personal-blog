/**
 * Comment Moderate API Routes
 * PUT /api/comments/[id]/moderate - 审核评论
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { moderateComment } from '@/server/features/comment'

const moderateSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

// PUT /api/comments/[id]/moderate
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = moderateSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const comment = await moderateComment(params.id, validated.data.action)

    return NextResponse.json({
      success: true,
      message: validated.data.action === 'approve' ? '评论已通过' : '评论已拒绝',
      data: comment,
    })
  } catch (error) {
    console.error('Failed to moderate comment:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '审核评论失败' },
      { status: 500 }
    )
  }
}
