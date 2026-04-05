/**
 * Categories API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/server/features/category'

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

// PATCH /api/categories/[id]
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少分类 ID' },
        { status: 400 }
      )
    }

    const category = await updateCategory(id, data)

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Failed to update category:', error)
    return NextResponse.json(
      { success: false, error: '更新分类失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/categories/[id]
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少分类 ID' },
        { status: 400 }
      )
    }

    await deleteCategory(id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Failed to delete category:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除分类失败' },
      { status: 500 }
    )
  }
}
