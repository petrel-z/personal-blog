import { NextResponse } from 'next/server'
import { errors, paginated } from '@/lib/api-response'
import { searchQuerySchema } from '@/server/features/search/search-query'
import { searchPosts } from '@/server/features/search/search.service'
import { consumeSearchRequest } from '@/server/features/search/search-rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const params = new URL(request.url).searchParams
  const query = searchQuerySchema.safeParse({
    keyword: params.get('keyword') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })

  if (!query.success) {
    return NextResponse.json(errors.badRequest(query.error.issues[0].message), { status: 400, headers })
  }

  const quota = consumeSearchRequest(request)
  if (!quota.allowed) {
    return NextResponse.json(errors.rateLimited('搜索过于频繁，请稍后重试'), {
      status: 429, headers: { ...headers, 'Retry-After': String(quota.retryAfter) },
    })
  }

  try {
    const { items, total, page, pageSize } = await searchPosts(query.data)
    return NextResponse.json(paginated(items, total, page, pageSize), { headers })
  } catch (error) {
    console.error('Failed to search posts:', error)
    return NextResponse.json(errors.serverError('搜索失败，请稍后重试'), { status: 500, headers })
  }
}
