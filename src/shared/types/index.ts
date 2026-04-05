// Re-export Prisma types
export type {
  User,
  Role,
  Permission,
  Post,
  Category,
  Tag,
  Comment,
  AuditLog,
  Settings,
  SensitiveWord,
} from '@prisma/client'

export { PostStatus, CommentStatus } from '@prisma/client'

// Session user type (extends NextAuth types)
export interface SessionUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Feature types
export interface PostWithRelations {
  id: string
  title: string
  slug: string
  summary?: string | null
  content: string
  coverImage?: string | null
  status: PostStatus
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt?: Date | null
  category?: {
    id: string
    name: string
    slug: string
  } | null
  tags: {
    id: string
    name: string
    slug: string
  }[]
  author: {
    id: string
    name?: string | null
  }
}

export interface CommentWithReplies {
  id: string
  content: string
  nickname: string
  avatar?: string | null
  status: CommentStatus
  createdAt: Date
  replies?: CommentWithReplies[]
}
