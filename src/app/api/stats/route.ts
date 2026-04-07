/**
 * Stats API Routes
 */

import { NextResponse } from 'next/server'
import { getOverviewStats, getTrendingPosts, getViewStats } from '@/server/features/stats'
import { success, errors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

// GET /api/stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'
    const timeframe = (searchParams.get('timeframe') as 'all' | 'month' | 'week') || 'all'

    if (type === 'trending' || type === 'popular') {
      const posts = await getTrendingPosts(timeframe)
      return NextResponse.json(success(posts), {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      })
    }

    if (type === 'views') {
      const viewsTimeframe = (searchParams.get('timeframe') as '7d' | '30d' | '90d') || '7d'
      const stats = await getViewStats(viewsTimeframe)
      return NextResponse.json(success(stats), {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      })
    }

    // 默认返回概览统计
    const stats = await getOverviewStats()
    return NextResponse.json(success(stats), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(errors.serverError('获取统计数据失败'))
  }
}
