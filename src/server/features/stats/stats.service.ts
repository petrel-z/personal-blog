/**
 * Stats Service - 统计业务逻辑
 */

import { prisma } from '@/server/db'

export async function getOverviewStats() {
  const [postCount, commentCount, viewStats] = await Promise.all([
    prisma.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.comment.count({ where: { status: 'APPROVED' } }),
    prisma.post.aggregate({
      where: { status: 'PUBLISHED' },
      _sum: { viewCount: true, likeCount: true },
    }),
  ])

  return {
    postCount,
    commentCount,
    totalViews: viewStats._sum.viewCount || 0,
    totalLikes: viewStats._sum.likeCount || 0,
  }
}

export async function getTrendingPosts(timeframe: 'all' | 'month' | 'week' = 'all') {
  let dateFilter = {}
  if (timeframe === 'month') {
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    dateFilter = { publishedAt: { gte: monthAgo } }
  } else if (timeframe === 'week') {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    dateFilter = { publishedAt: { gte: weekAgo } }
  }

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      ...dateFilter,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      publishedAt: true,
    },
  })

  // 热度计算: 阅读×0.6 + 点赞×0.3 + 评论×0.1
  return posts
    .map((post) => ({
      ...post,
      hotScore:
        post.viewCount * 0.6 + post.likeCount * 0.3 + post.commentCount * 0.1,
    }))
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 10)
}

export async function getViewStats(timeframe: '7d' | '30d' | '90d') {
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // 这里简化处理，实际可能需要每日汇总表
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: startDate },
    },
    select: {
      id: true,
      title: true,
      viewCount: true,
      publishedAt: true,
    },
  })

  return {
    posts,
    total: posts.reduce((sum, p) => sum + p.viewCount, 0),
  }
}
