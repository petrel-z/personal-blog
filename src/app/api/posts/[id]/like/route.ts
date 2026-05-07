/**
 * Post Like API Routes
 * GET /api/posts/[id]/like - 获取点赞状态
 * POST /api/posts/[id]/like - 切换点赞状态
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { getClientIp } from '@/server/lib/request'
import { success, errors } from '@/lib/api-response'

// GET /api/posts/[id]/like - 获取当前IP的点赞状态
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ip = getClientIp(request) || 'unknown'

    const [like, post] = await Promise.all([
      prisma.postLike.findUnique({
        where: {
          ip_postId: {
            ip,
            postId: params.id,
          },
        },
      }),
      prisma.post.findUnique({
        where: { id: params.id },
        select: { likeCount: true },
      }),
    ])

    // 点赞状态：记录存在且未删除
    const isLiked = !!like && !like.deletedAt

    return NextResponse.json(success({
      liked: isLiked,
      likeCount: post?.likeCount || 0,
    }))
  } catch (error) {
    console.error('Failed to get like status:', error)
    return NextResponse.json(errors.serverError('获取点赞状态失败'))
  }
}

// POST /api/posts/[id]/like - 切换点赞状态（软删除方案）
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ip = getClientIp(request) || 'unknown'

    const existingLike = await prisma.postLike.findUnique({
      where: {
        ip_postId: {
          ip,
          postId: params.id,
        },
      },
    })

    if (existingLike && !existingLike.deletedAt) {
      // 已点赞 → 软删除取消点赞
      await prisma.$transaction([
        prisma.postLike.update({
          where: { id: existingLike.id },
          data: { deletedAt: new Date() },
        }),
        prisma.post.update({
          where: { id: params.id },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
    } else {
      // 未点赞或已取消 → 恢复或创建点赞
      if (existingLike) {
        // 恢复之前的记录
        await prisma.$transaction([
          prisma.postLike.update({
            where: { id: existingLike.id },
            data: { deletedAt: null },
          }),
          prisma.post.update({
            where: { id: params.id },
            data: { likeCount: { increment: 1 } },
          }),
        ])
      } else {
        // 创建新记录
        await prisma.$transaction([
          prisma.postLike.create({
            data: { ip, postId: params.id },
          }),
          prisma.post.update({
            where: { id: params.id },
            data: { likeCount: { increment: 1 } },
          }),
        ])
      }
    }

    // 返回最新的点赞状态和总数
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { likeCount: true },
    })
    const isLiked = !!(existingLike && !existingLike.deletedAt)

    return NextResponse.json(success({
      liked: !isLiked,
      likeCount: post?.likeCount || 0,
    }))
  } catch (error) {
    console.error('Failed to toggle like:', error)
    return NextResponse.json(errors.serverError('点赞失败'))
  }
}
