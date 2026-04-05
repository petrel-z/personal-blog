/**
 * Stats API Routes
 */

import { NextResponse } from 'next/server'
import { getOverviewStats, getTrendingPosts, getViewStats } from '@/server/features/stats'

// GET /api/stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'
    const timeframe = (searchParams.get('timeframe') as 'all' | 'month' | 'week') || 'all'

    if (type === 'trending') {
      const posts = await getTrendingPosts(timeframe)
      return NextResponse.json({ success: true, data: posts })
    }

    if (type === 'views') {
      const viewsTimeframe = (searchParams.get('timeframe') as '7d' | '30d' | '90d') || '7d'
      const stats = await getViewStats(viewsTimeframe)
      return NextResponse.json({ success: true, data: stats })
    }

    // 默认返回概览统计
    const stats = await getOverviewStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
