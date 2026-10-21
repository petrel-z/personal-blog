export const dynamic = 'force-dynamic'

import { withPermission, accessErrorResponse } from '@/server/auth/route'
import { assertPermission, type Actor } from '@/server/auth/access'
/**
 * Comment Moderate API Routes
 * PUT /api/comments/[id]/moderate - 审核评论
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { moderateComment } from '@/server/features/comment'
import { logAdminActionWithRequest, AuditAction } from '@/server/features/audit-log'
import { prisma } from '@/server/db'
import { success, errors } from '@/lib/api-response'

const moderateSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

// PUT /api/comments/[id]/moderate
export const PUT = withPermission(['comment:approve', 'comment:reject'], async function PUT(
  request: Request,
  { params }: { params: { id: string } },
  actor: Actor
) {
  try {
    const body = await request.json()
    const validated = moderateSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError('无效的审核操作')
      )
    }

    assertPermission(actor, validated.data.action === 'approve' ? 'comment:approve' : 'comment:reject')

    // Get comment info before moderate for audit log
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      select: { content: true, nickname: true },
    })

    const moderatedComment = await moderateComment(params.id, validated.data.action)

    // Create audit log
    await logAdminActionWithRequest(actor.id, {
      action: validated.data.action === 'approve' ? AuditAction.COMMENT_APPROVE : AuditAction.COMMENT_REJECT,
      target: `评论: ${comment?.nickname || params.id}`,
      details: validated.data.action === 'approve'
        ? `审核通过评论: ${comment?.content?.slice(0, 50)}...`
        : `审核拒绝评论: ${comment?.content?.slice(0, 50)}...`,
    }, request)

    return NextResponse.json({
      ...success(moderatedComment),
      message: validated.data.action === 'approve' ? '评论已通过' : '评论已拒绝',
    })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Failed to moderate comment:', error)
    return NextResponse.json(
      errors.serverError(error instanceof Error ? error.message : '审核评论失败')
    )
  }
})
