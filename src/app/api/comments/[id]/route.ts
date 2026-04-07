/**
 * Comment Detail API Routes
 * GET /api/comments/[id] - 获取单条评论
 * DELETE /api/comments/[id] - 删除评论
 */

import { NextResponse } from 'next/server'
import { deleteComment } from '@/server/features/comment'
import { prisma } from '@/server/db'
import { auth } from '@/auth'
import { logAdminActionWithRequest, AuditAction } from '@/server/features/audit-log'
import { success, errors } from '@/lib/api-response'

 // GET /api/comments/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      include: {
        post: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!comment) {
      return NextResponse.json(errors.notFound('评论不存在'))
    }

    return NextResponse.json(success(comment))
  } catch (error) {
    console.error('Failed to fetch comment:', error)
    return NextResponse.json(errors.serverError('获取评论失败'))
  }
}

// DELETE /api/comments/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    // Get comment info before delete for audit log
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      select: { content: true, nickname: true },
    })

    await deleteComment(params.id)

    // Create audit log
    if (session?.user?.id && comment) {
      await logAdminActionWithRequest(session.user.id, {
        action: AuditAction.COMMENT_DELETE,
        target: `评论: ${comment.nickname}`,
        details: `删除评论: ${comment.content?.slice(0, 50)}...`,
      }, request)
    }

    return NextResponse.json(success(null, '删除成功'))
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return NextResponse.json(errors.serverError(error instanceof Error ? error.message : '删除评论失败'))
  }
}
