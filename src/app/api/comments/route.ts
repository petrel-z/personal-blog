/**
 * Comments API Routes
 * 只负责：解析参数、调用业务逻辑、返回响应
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getComments, createComment } from '@/server/features/comment'
import { success, errors, paginated } from '@/lib/api-response'
import { ApiCode } from '@/lib/api-response'
import { consumeCaptcha } from '@/server/features/auth/captcha.service'

export const dynamic = 'force-dynamic'

const createCommentSchema = z.object({
  nickname: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  content: z.string().min(1).max(500),
  captchaCode: z.string().length(4),
  captchaId: z.string(),
  postId: z.string(),
  parentId: z.string().optional(),
})

// GET /api/comments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId') || undefined
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 10

    const result = await getComments({ postId, page, pageSize })

    return NextResponse.json(
      paginated(result.comments, result.total, result.page, result.pageSize)
    )
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return NextResponse.json(errors.serverError('获取评论列表失败'))
  }
}

// POST /api/comments
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCommentSchema.safeParse({...body, captchaCode: body.captchaCode ?? body.captcha})

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.content?.[0] || '数据验证失败')
      )
    }

    if (!await consumeCaptcha({id:validated.data.captchaId, code:validated.data.captchaCode, purpose:'comment'})) {
      return NextResponse.json(errors.badRequest('验证码错误或已过期'), {status:400})
    }

    // Get IP and UserAgent for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    const result = await createComment({
      ...validated.data,
      captcha: validated.data.captchaCode,
      ip,
      userAgent,
    })

    if (!result.success) {
      return NextResponse.json(
        errors.rateLimited(result.message)
      )
    }

    return NextResponse.json({
      code: ApiCode.SUCCESS,
      message: result.message,
      data: result.comment,
      timestamp: Date.now(),
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create comment:', error)
    return NextResponse.json(errors.serverError('评论提交失败'))
  }
}
