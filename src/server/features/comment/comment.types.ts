/**
 * Comment Types - 评论相关类型定义
 */

import { Comment } from '@prisma/client'

export interface CreateCommentInput {
  postId: string
  nickname: string
  email?: string
  website?: string
  content: string
  captcha: string
  parentId?: string
  captchaId?: string
  ip?: string
  userAgent?: string
}

export interface CommentListParams {
  postId?: string
  page?: number
  pageSize?: number
}

export interface CommentModerateParams {
  id: string
  action: 'approve' | 'reject'
}

export interface CreateCommentResult {
  success: boolean
  message: string
  comment?: Comment
  needsApproval?: boolean
}
