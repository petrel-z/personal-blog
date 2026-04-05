/**
 * Sensitive Word Detail API Routes
 * PUT /api/sensitive-words/[id]
 * DELETE /api/sensitive-words/[id]
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateSensitiveWord, deleteSensitiveWord } from '@/server/features/sensitive-word'

const updateSensitiveWordSchema = z.object({
  word: z.string().min(1).max(50).optional(),
  category: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
})

// PUT /api/sensitive-words/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = updateSensitiveWordSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const sensitiveWord = await updateSensitiveWord(params.id, validated.data)

    return NextResponse.json({ success: true, data: sensitiveWord })
  } catch (error) {
    console.error('Failed to update sensitive word:', error)
    return NextResponse.json(
      { success: false, error: '更新敏感词失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/sensitive-words/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteSensitiveWord(params.id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Failed to delete sensitive word:', error)
    return NextResponse.json(
      { success: false, error: '删除敏感词失败' },
      { status: 500 }
    )
  }
}
