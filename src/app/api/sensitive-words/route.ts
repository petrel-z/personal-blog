/**
 * Sensitive Words API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSensitiveWords, createSensitiveWord } from '@/server/features/sensitive-word'
import { success, created, errors, paginated } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

const createSensitiveWordSchema = z.object({
  word: z.string().min(1).max(50),
  category: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/sensitive-words
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 20
    const category = searchParams.get('category') || undefined

    const result = await getSensitiveWords({ page, pageSize, category })

    return NextResponse.json(
      paginated(result.words, result.total, result.page, result.pageSize)
    )
  } catch (error) {
    console.error('Failed to fetch sensitive words:', error)
    return NextResponse.json(errors.serverError('获取敏感词列表失败'))
  }
}

// POST /api/sensitive-words
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createSensitiveWordSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError('敏感词验证失败'))
    }

    const sensitiveWord = await createSensitiveWord(validated.data)

    return NextResponse.json(
      created(sensitiveWord),
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create sensitive word:', error)
    return NextResponse.json(errors.serverError('创建敏感词失败'))
  }
}
