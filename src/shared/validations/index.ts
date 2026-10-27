import { z } from 'zod'
import { accountSchema } from './account'
import {
  POST_TITLE_MIN_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_CONTENT_MIN_LENGTH,
  COMMENT_NICKNAME_MIN_LENGTH,
  COMMENT_NICKNAME_MAX_LENGTH,
  COMMENT_CONTENT_MAX_LENGTH,
} from '../constants'

export const createPostSchema = z.object({
  title: z.string()
    .min(POST_TITLE_MIN_LENGTH, '标题不能为空')
    .max(POST_TITLE_MAX_LENGTH, '标题不能超过200字符'),
  content: z.string()
    .min(POST_CONTENT_MIN_LENGTH, '内容不能为空'),
  summary: z.string().max(500, '摘要不能超过500字符').optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  coverImage: z.string().url('封面图链接无效').optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  isPinned: z.boolean().optional(),
  createdAt: z.string().datetime().optional(), // 自定义创建时间
})

export const updatePostSchema = createPostSchema.partial()

export const createCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(50, '分类名称不能超过50字符'),
  slug: z.string().min(1, 'slug不能为空').max(50, 'slug不能超过50字符'),
  description: z.string().max(200, '描述不能超过200字符').optional(),
})

export const createTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(20, '标签名称不能超过20字符'),
  slug: z.string().min(1, 'slug不能为空').max(20, 'slug不能超过20字符'),
})

export const createCommentSchema = z.object({
  nickname: z.string()
    .min(COMMENT_NICKNAME_MIN_LENGTH, '昵称不能为空')
    .max(COMMENT_NICKNAME_MAX_LENGTH, '昵称不能超过20字符'),
  email: z.string().email('邮箱格式无效').optional().or(z.literal('')),
  website: z.string().url('网站链接无效').optional().or(z.literal('')),
  content: z.string()
    .min(1, '评论内容不能为空')
    .max(COMMENT_CONTENT_MAX_LENGTH, '评论不能超过500字符'),
  captcha: z.string().length(4, '验证码为4位'),
  postId: z.string(),
  parentId: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.string().email('邮箱格式无效'),
  password: z.string().min(1, '密码不能为空'),
  captcha: z.string().length(4, '验证码为4位'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = accountSchema.extend({
  confirmPassword: z.string().min(1, '请确认密码'),
  captcha: z.string().length(4, '验证码为4位'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
})


export const resetRequestFormSchema = z.object({
  email: accountSchema.shape.email,
  captcha: z.string().regex(/^[a-z0-9]{4}$/i, '请输入 4 位图片验证码'),
})

export const resetPasswordFormSchema = z.object({
  email: accountSchema.shape.email,
  code: z.string().regex(/^\d{6}$/, '请输入 6 位数字邮件验证码'),
  newPassword: accountSchema.shape.password,
  confirmPassword: z.string().min(1, '请确认新密码'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: '两次密码不一致', path: ['confirmPassword'],
})
