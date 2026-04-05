/**
 * Tag Detail API Routes
 * PUT /api/tags/[id]
 * DELETE /api/tags/[id]
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateTag, deleteTag } from '@/server/features/tag'

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
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const tag = await updateTag(params.id, validated.data)

    return NextResponse.json({ success: true, data: tag })
  } catch (error) {
    console.error('Failed to update tag:', error)
    return NextResponse.json(
      { success: false, error: '更新标签失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/tags/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteTag(params.id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Failed to delete tag:', error)
    return NextResponse.json(
      { success: false, error: '删除标签失败' },
      { status: 500 }
    )
  }
}
