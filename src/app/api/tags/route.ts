/**
 * Tags API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTags, createTag, deleteTag } from '@/server/features/tag'

const createTagSchema = z.object({
  name: z.string().min(1).max(20),
  slug: z.string().min(1).max(20),
})

// GET /api/tags
export async function GET() {
  try {
    const tags = await getTags()
    return NextResponse.json({ success: true, data: tags })
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json(
      { success: false, error: '获取标签列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/tags
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createTagSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const tag = await createTag(validated.data)

    return NextResponse.json({ success: true, data: tag }, { status: 201 })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json(
      { success: false, error: '创建标签失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/tags?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少标签 ID' },
        { status: 400 }
      )
    }

    await deleteTag(id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Failed to delete tag:', error)
    return NextResponse.json(
      { success: false, error: '删除标签失败' },
      { status: 500 }
    )
  }
}
