/**
 * Comment Service - 评论业务逻辑
 */

import { prisma } from '@/server/db'
import { Prisma } from '@prisma/client'
import { CreateCommentInput } from './comment.types'
import { CommentStatus } from '@prisma/client'
import { checkSensitiveWords } from '../sensitive-word'
import { getSettingByKey } from '../settings'

// Rate limiting: 1 comment per minute per IP
const commentRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_COMMENTS_PER_WINDOW = 1

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = commentRateLimit.get(ip)

  if (!record || record.resetAt < now) {
    commentRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= MAX_COMMENTS_PER_WINDOW) {
    return false
  }

  record.count++
  return true
}

export async function getComments(params: {
  postId?: string
  page?: number
  pageSize?: number
}) {
  const { postId, page = 1, pageSize = 10 } = params

  const where = postId
    ? { postId, status: CommentStatus.APPROVED, parentId: null }
    : { status: CommentStatus.APPROVED, parentId: null }

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

export async function createComment(data: CreateCommentInput): Promise<{
  success: boolean
  message: string
  comment?: any
  needsApproval?: boolean
}> {
  // Rate limiting check
  if (data.ip && !checkRateLimit(data.ip)) {
    return {
      success: false,
      message: '评论过于频繁，请稍后再试',
    }
  }

  // Sensitive word check
  const hasSensitiveWord = await checkSensitiveWords(data.content)
  if (hasSensitiveWord) {
    return {
      success: false,
      message: '评论包含敏感词，请修改后重试',
    }
  }

  // Check auto-approve setting
  const autoApprove = await getSettingByKey('autoApproveComments')
  const shouldAutoApprove = autoApprove === 'true' || autoApprove === '1'

  const comment = await prisma.comment.create({
    data: {
      nickname: data.nickname,
      email: data.email || null,
      website: data.website || null,
      content: data.content,
      postId: data.postId,
      parentId: data.parentId || null,
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      status: shouldAutoApprove ? CommentStatus.APPROVED : CommentStatus.PENDING,
    },
  })

  // Update post comment count and return for approved comments
  if (shouldAutoApprove) {
    await prisma.post.update({
      where: { id: data.postId },
      data: { commentCount: { increment: 1 } },
    })
    return {
      success: true,
      message: '评论发布成功',
      comment,
      needsApproval: false,
    }
  }

  return {
    success: true,
    message: '评论提交成功，等待审核',
    comment,
    needsApproval: true,
  }
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

  const where: Prisma.CommentWhereInput = {}
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
