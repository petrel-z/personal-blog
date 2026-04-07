/**
 * Categories API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCategories, createCategory } from '@/server/features/category'
import { success, created, errors } from '@/lib/api-response'

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
})

// GET /api/categories
export async function GET() {
  try {
    const categories = await getCategories()
    return NextResponse.json(success(categories), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to fetch categories:', error)
    return NextResponse.json(errors.serverError('获取分类列表失败'))
  }
}

// POST /api/categories
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCategorySchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.name?.[0] || '数据验证失败')
      )
    }

    const category = await createCategory(validated.data)

    return NextResponse.json(created(category), { status: 201 })
  } catch (error) {
    console.error('Failed to create category:', error)
    return NextResponse.json(errors.serverError('创建分类失败'))
  }
}
