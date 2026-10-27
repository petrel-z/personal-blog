import { prisma } from '@/server/db'

export type StatsPeriod = '7d' | '30d' | '90d'
const day = 86_400_000
const shanghaiOffset = 8 * 3_600_000

/** Explicit UTC+8 boundaries: do not depend on the application server's timezone. */
function windowFor(period: StatsPeriod, now: Date) {
  const days = Number.parseInt(period, 10)
  const today = Math.floor((now.getTime() + shanghaiOffset) / day) * day - shanghaiOffset
  return { days, today, start: today - (days - 1) * day, previousStart: today - (2 * days - 1) * day, end: today + day }
}
function dateKey(timestamp: number) { return new Date(timestamp + shanghaiOffset).toISOString().slice(0, 10) }

export async function getAdminViewStats(period: StatsPeriod, now = new Date()) {
  const window = windowFor(period, now)
  // Aggregate in the database instead of transferring every individual view to the client/server.
  const [rows, total] = await Promise.all([
    prisma.$queryRaw<{ date: string; views: bigint }[]>`
      SELECT DATE_FORMAT(DATE_ADD(v.viewedAt, INTERVAL 8 HOUR), '%Y-%m-%d') AS date, COUNT(*) AS views
      FROM PostView v JOIN Post p ON p.id = v.postId
      WHERE v.viewedAt >= ${new Date(window.previousStart)} AND v.viewedAt < ${new Date(window.end)}
        AND p.status = 'PUBLISHED' AND p.deletedAt IS NULL
      GROUP BY date ORDER BY date ASC
    `,
    prisma.post.aggregate({ where: { status: 'PUBLISHED', deletedAt: null }, _sum: { viewCount: true } }),
  ])
  const byDate = new Map(rows.map(row => [row.date, Number(row.views)]))
  const views = Array.from({ length: window.days }, (_, i) => {
    const date = dateKey(window.start + i * day)
    return { date, views: byDate.get(date) ?? 0 }
  })
  const periodViews = views.reduce((sum, item) => sum + item.views, 0)
  const previousViews = Array.from({ length: window.days }, (_, i) => byDate.get(dateKey(window.previousStart + i * day)) ?? 0).reduce((sum, n) => sum + n, 0)
  return { views, overview: {
    totalViews: total._sum.viewCount ?? 0,
    todayViews: views.at(-1)?.views ?? 0,
    periodViews,
    avgViews: Math.round(periodViews / window.days),
    growth: previousViews > 0 ? Math.round((periodViews - previousViews) / previousViews * 1000) / 10 : null,
  } }
}

const popularSelect = { id: true, title: true, slug: true, viewCount: true, likeCount: true, commentCount: true, publishedAt: true, category: { select: { name: true } } } as const

export async function getAdminPopularPosts(period: StatsPeriod | 'all', now = new Date()) {
  const published = { status: 'PUBLISHED' as const, deletedAt: null }
  if (period === 'all') {
    const posts = await prisma.post.findMany({ where: published, select: popularSelect, orderBy: [{ viewCount: 'desc' }, { id: 'asc' }], take: 20 })
    return posts.map(post => ({ ...post, periodViews: post.viewCount }))
  }
  const window = windowFor(period, now)
  const counts = await prisma.postView.groupBy({
    by: ['postId'], where: { viewedAt: { gte: new Date(window.start), lt: new Date(window.end) }, post: published },
    _count: { postId: true }, orderBy: [{ _count: { postId: 'desc' } }, { postId: 'asc' }], take: 20,
  })
  if (!counts.length) return []
  const posts = await prisma.post.findMany({ where: { ...published, id: { in: counts.map(row => row.postId) } }, select: popularSelect })
  const byId = new Map(posts.map(post => [post.id, post]))
  return counts.flatMap(row => { const post = byId.get(row.postId); return post ? [{ ...post, periodViews: row._count.postId }] : [] })
}
