/**
 * Comment Detail API Routes
 * GET /api/comments/[id] - 获取单条评论
 * DELETE /api/comments/[id] - 删除评论
 */

import { NextResponse } from 'next/server'
import { deleteComment } from '@/server/features/comment'
import { prisma } from '@/server/db'

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
      return NextResponse.json(
        { success: false, error: '评论不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: comment })
  } catch (error) {
    console.error('Failed to fetch comment:', error)
    return NextResponse.json(
      { success: false, error: '获取评论失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/comments/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteComment(params.id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除评论失败' },
      { status: 500 }
    )
  }
}
