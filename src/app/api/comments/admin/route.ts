/**
 * Admin Comments API Routes
 * 评论管理API - 需要管理员权限
 */

import { NextResponse } from 'next/server'
import { getAdminComments } from '@/server/features/comment'
import { success, errors, paginated } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

// GET /api/comments/admin
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 20
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null
    const postId = searchParams.get('postId') || undefined

    const result = await getAdminComments({
      page,
      pageSize,
      status: status || undefined,
      postId,
    })

    return NextResponse.json(
      paginated(result.comments, result.total, result.page, result.pageSize)
    )
  } catch (error) {
    console.error('Failed to fetch admin comments:', error)
    return NextResponse.json(errors.serverError('获取评论列表失败'))
  }
}
