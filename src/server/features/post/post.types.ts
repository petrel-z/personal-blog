/**
 * Post Types - 文章相关类型定义
 */

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

export interface UpdatePostInput {
  title?: string
  content?: string
  summary?: string | null
  categoryId?: string | null
  tags?: string[]
  coverImage?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  isPinned?: boolean
}

export interface PostListParams {
  page?: number
  pageSize?: number
  status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'DELETED' | null
  categoryId?: string
  tagSlug?: string
}

export interface PostListResult {
  posts: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
