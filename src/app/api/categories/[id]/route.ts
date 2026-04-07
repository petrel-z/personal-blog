/**
 * Category Detail API Routes
 * GET /api/categories/[id]
 * PUT /api/categories/[id]
 * DELETE /api/categories/[id]
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} from '@/server/features/category'
import { success, errors } from '@/lib/api-response'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
})

// GET /api/categories/[id] or /api/categories/[slug]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const category = await getCategoryBySlug(params.id)

    if (!category) {
      return NextResponse.json(errors.notFound('分类不存在'))
    }

    return NextResponse.json(success(category))
  } catch (error) {
    console.error('Failed to fetch category:', error)
    return NextResponse.json(errors.serverError('获取分类失败'))
  }
}

// PUT /api/categories/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = updateCategorySchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.name?.[0] || '数据验证失败')
      )
    }

    const category = await updateCategory(params.id, validated.data)

    return NextResponse.json(success(category))
  } catch (error) {
    console.error('Failed to update category:', error)
    return NextResponse.json(errors.serverError('更新分类失败'))
  }
}

// DELETE /api/categories/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteCategory(params.id)

    return NextResponse.json(success(null, '删除成功'))
  } catch (error) {
    console.error('Failed to delete category:', error)
    return NextResponse.json(
      errors.serverError(error instanceof Error ? error.message : '删除分类失败')
    )
  }
}
