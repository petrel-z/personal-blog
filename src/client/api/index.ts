/**
 * API Client - 基于统一封装的 fetch
 */

import { api } from './fetch'
import type { ApiResponse } from './fetch'

// Re-export api for convenience
export { api }

// ==================== Types ====================

export interface Post {
  id: string
  title: string
  slug: string
  content: string
  summary?: string
  coverImage?: string
  status: string
  viewCount: number
  likeCount: number
  commentCount: number
  category?: Category
  tags?: Tag[]
  author?: { id: string; name?: string }
  publishedAt?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  postCount: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount: number
}

export interface Comment {
  id: string
  content: string
  nickname: string
  avatar?: string
  status: string
  createdAt: string
  children?: Comment[]
}

export interface CreatePostInput {
  title: string
  content: string
  summary?: string
  categoryId?: string
  tags?: string[]
  coverImage?: string
  status?: 'DRAFT' | 'PUBLISHED'
  isPinned?: boolean
}

export interface CreateCommentInput {
  postId: string
  nickname: string
  email?: string
  website?: string
  content: string
  captcha: string
  parentId?: string
}

export interface StatsOverview {
  postCount: number
  commentCount: number
  totalViews: number
  totalLikes: number
}

export interface TrendingPost extends Post {
  hotScore: number
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ==================== Posts API ====================

export const postsApi = {
  /** 获取文章列表 */
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<Post[]>('/posts', params),

  /** 获取单篇文章 */
  get: (id: string) => api.get<Post>(`/posts/${id}`),

  /** 获取单篇文章 by slug */
  getBySlug: (slug: string) => api.get<Post>(`/posts/${slug}`),

  /** 创建文章 */
  create: (data: CreatePostInput) => api.post<Post>('/posts', data),

  /** 更新文章 */
  update: (id: string, data: Partial<CreatePostInput>) =>
    api.patch<Post>(`/posts/${id}`, data),

  /** 删除文章 */
  delete: (id: string) => api.delete<void>(`/posts/${id}`),
}

// ==================== Comments API ====================

export const commentsApi = {
  /** 获取评论列表 */
  list: (params?: { postId?: string; page?: number; pageSize?: number }) =>
    api.get<Comment[]>('/comments', params),

  /** 创建评论 */
  create: (data: CreateCommentInput) =>
    api.post<Comment>('/comments', data),

  /** 审核评论 */
  moderate: (id: string, action: 'approve' | 'reject') =>
    api.post<void>(`/comments/${id}/moderate?action=${action}`),

  /** 删除评论 */
  delete: (id: string) => api.delete<void>(`/comments/${id}`),
}

// ==================== Categories API ====================

export const categoriesApi = {
  /** 获取所有分类 */
  list: () => api.get<Category[]>('/categories'),

  /** 创建分类 */
  create: (data: { name: string; slug: string; description?: string }) =>
    api.post<Category>('/categories', data),

  /** 更新分类 */
  update: (
    id: string,
    data: { name?: string; slug?: string; description?: string }
  ) => api.patch<Category>(`/categories/${id}`, data),

  /** 删除分类 */
  delete: (id: string) => api.delete<void>(`/categories/${id}`),
}

// ==================== Tags API ====================

export const tagsApi = {
  /** 获取所有标签 */
  list: () => api.get<Tag[]>('/tags'),

  /** 创建标签 */
  create: (data: { name: string; slug: string }) =>
    api.post<Tag>('/tags', data),

  /** 删除标签 */
  delete: (id: string) => api.delete<void>(`/tags/${id}`),
}

// ==================== Stats API ====================

export const statsApi = {
  /** 获取概览统计 */
  overview: () => api.get<StatsOverview>('/stats'),

  /** 获取热度排行 */
  trending: (timeframe?: 'all' | 'month' | 'week') =>
    api.get<TrendingPost[]>('/stats', { type: 'trending', timeframe }),
}
