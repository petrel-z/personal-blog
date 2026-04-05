/**
 * Comment Service - 评论业务逻辑
 */

import { prisma } from '@/server/db'
import { CreateCommentInput } from './comment.types'

export async function getComments(params: {
  postId?: string
  page?: number
  pageSize?: number
}) {
  const { postId, page = 1, pageSize = 10 } = params

  const where = postId
    ? { postId, status: 'APPROVED', parentId: null }
    : { status: 'APPROVED', parentId: null }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        children: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'asc' },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comment.count({ where }),
  ])

  return {
    comments,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function createComment(data: CreateCommentInput) {
  // TODO: 验证码校验
  // TODO: 敏感词检查
  // TODO: 频率限制

  const comment = await prisma.comment.create({
    data: {
      nickname: data.nickname,
      email: data.email || null,
      website: data.website || null,
      content: data.content,
      postId: data.postId,
      parentId: data.parentId || null,
      status: 'PENDING', // 默认待审核
    },
  })

  // 更新文章评论数
  await prisma.post.update({
    where: { id: data.postId },
    data: { commentCount: { increment: 1 } },
  })

  return comment
}

export async function moderateComment(id: string, action: 'approve' | 'reject') {
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED'

  const comment = await prisma.comment.update({
    where: { id },
    data: { status },
  })

  return comment
}

export async function deleteComment(id: string) {
  // 获取评论信息
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { postId: true, parentId: true },
  })

  if (!comment) {
    throw new Error('评论不存在')
  }

  // 如果是回复，减少父评论的子评论数，或直接删除
  if (comment.parentId) {
    await prisma.comment.deleteMany({
      where: { id },
    })
  } else {
    // 如果是父评论，删除及其子评论
    await prisma.comment.deleteMany({
      where: {
        OR: [{ id }, { parentId: id }],
      },
    })
  }

  // 减少文章评论数
  await prisma.post.update({
    where: { id: comment.postId },
    data: { commentCount: { decrement: 1 } },
  })
}

export async function getAdminComments(params: {
  page?: number
  pageSize?: number
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  postId?: string
}) {
  const { page = 1, pageSize = 10, status, postId } = params

  const where: any = {}
  if (status) where.status = status
  if (postId) where.postId = postId

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        post: {
          select: { id: true, title: true, slug: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comment.count({ where }),
  ])

  return {
    comments,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
