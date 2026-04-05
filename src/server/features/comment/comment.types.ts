/**
 * Comment Types - 评论相关类型定义
 */

export interface CreateCommentInput {
  postId: string
  nickname: string
  email?: string
  website?: string
  content: string
  captcha: string
  parentId?: string
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
