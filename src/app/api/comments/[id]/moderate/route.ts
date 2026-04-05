/**
 * Comment Moderate API Routes
 * PUT /api/comments/[id]/moderate - 审核评论
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { moderateComment } from '@/server/features/comment'
import { auth } from '@/auth'
import { logAdminActionWithRequest, AuditAction } from '@/server/features/audit-log'
import { prisma } from '@/server/db'

const moderateSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

// PUT /api/comments/[id]/moderate
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const body = await request.json()
    const validated = moderateSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    // Get comment info before moderate for audit log
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      select: { content: true, nickname: true },
    })

    const moderatedComment = await moderateComment(params.id, validated.data.action)

    // Create audit log
    if (session?.user?.id) {
      await logAdminActionWithRequest(session.user.id, {
        action: validated.data.action === 'approve' ? AuditAction.COMMENT_APPROVE : AuditAction.COMMENT_REJECT,
        target: `评论: ${comment?.nickname || params.id}`,
        details: validated.data.action === 'approve'
          ? `审核通过评论: ${comment?.content?.slice(0, 50)}...`
          : `审核拒绝评论: ${comment?.content?.slice(0, 50)}...`,
      }, request)
    }

    return NextResponse.json({
      success: true,
      message: validated.data.action === 'approve' ? '评论已通过' : '评论已拒绝',
      data: moderatedComment,
    })
  } catch (error) {
    console.error('Failed to moderate comment:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '审核评论失败' },
      { status: 500 }
    )
  }
}
