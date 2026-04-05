/**
 * Categories API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCategories, createCategory } from '@/server/features/category'

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
})

// GET /api/categories
export async function GET() {
  try {
    const categories = await getCategories()
    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Failed to fetch categories:', error)
    return NextResponse.json(
      { success: false, error: '获取分类列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/categories
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCategorySchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const category = await createCategory(validated.data)

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    console.error('Failed to create category:', error)
    return NextResponse.json(
      { success: false, error: '创建分类失败' },
      { status: 500 }
    )
  }
}
