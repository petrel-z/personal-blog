/**
 * Tags API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTags, createTag } from '@/server/features/tag'
import { success, created, errors } from '@/lib/api-response'

const createTagSchema = z.object({
  name: z.string().min(1).max(20),
  slug: z.string().min(1).max(20),
})

const updateTagSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  slug: z.string().min(1).max(20).optional(),
})

// GET /api/tags
export async function GET() {
  try {
    const tags = await getTags()
    return NextResponse.json(success(tags), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json(errors.serverError('获取标签列表失败'))
  }
}

// POST /api/tags
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createTagSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.name?.[0] || '数据验证失败')
      )
    }

    const tag = await createTag(validated.data)

    return NextResponse.json(created(tag), { status: 201 })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json(errors.serverError('创建标签失败'))
  }
}
