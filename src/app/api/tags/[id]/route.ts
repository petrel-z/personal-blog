/**
 * Tag Detail API Routes
 * PUT /api/tags/[id]
 * DELETE /api/tags/[id]
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateTag, deleteTag } from '@/server/features/tag'
import { success, errors } from '@/lib/api-response'

const updateTagSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  slug: z.string().min(1).max(20).optional(),
})

// PUT /api/tags/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = updateTagSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        errors.validationError(validated.error.flatten().fieldErrors?.name?.[0] || '数据验证失败')
      )
    }

    const tag = await updateTag(params.id, validated.data)

    return NextResponse.json(success(tag))
  } catch (error) {
    console.error('Failed to update tag:', error)
    return NextResponse.json(errors.serverError('更新标签失败'))
  }
}

// DELETE /api/tags/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteTag(params.id)

    return NextResponse.json(success(null, '删除成功'))
  } catch (error) {
    console.error('Failed to delete tag:', error)
    return NextResponse.json(errors.serverError('删除标签失败'))
  }
}
