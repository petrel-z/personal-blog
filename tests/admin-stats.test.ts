jest.mock('@/server/db', () => ({ prisma: { $queryRaw: jest.fn(), post: { aggregate: jest.fn(), findMany: jest.fn() }, postView: { groupBy: jest.fn() } } }))
import { prisma } from '@/server/db'
import { getAdminViewStats, getAdminPopularPosts } from '@/server/features/stats/admin-stats.service'

beforeEach(() => { jest.clearAllMocks(); (prisma.post.aggregate as jest.Mock).mockResolvedValue({ _sum: { viewCount: 150 } }) })
test('七天窗口按上海日期补零，增长比较上一完整同长周期', async () => {
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ date: '2026-10-20', views: BigInt(10) }, { date: '2026-10-21', views: BigInt(8) }, { date: '2026-10-27', views: BigInt(12) }])
  const data = await getAdminViewStats('7d', new Date('2026-10-27T04:00:00Z'))
  expect(data.views).toHaveLength(7)
  expect(data.views[0]).toEqual({ date: '2026-10-21', views: 8 })
  expect(data.views[6]).toEqual({ date: '2026-10-27', views: 12 })
  expect(data.views[1].views).toBe(0)
  expect(data.overview).toEqual({ totalViews: 150, todayViews: 12, periodViews: 20, avgViews: 3, growth: 100 })
  expect(prisma.post.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PUBLISHED', deletedAt: null } }))
})
test('没有基期时不伪造增长率；零点以北京时间切换', async () => {
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ date: '2026-10-28', views: BigInt(1) }])
  const data = await getAdminViewStats('7d', new Date('2026-10-27T16:01:00Z'))
  expect(data.views.at(-1)?.date).toBe('2026-10-28')
  expect(data.overview.growth).toBeNull()
})
test('热门文章按周期阅读记录排序，排除草稿和删除文章', async () => {
  ;(prisma.postView.groupBy as jest.Mock).mockResolvedValue([{ postId: 'b', _count: { postId: 8 } }, { postId: 'a', _count: { postId: 5 } }])
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([{ id: 'a', title: 'A', viewCount: 100 }, { id: 'b', title: 'B', viewCount: 30 }])
  const data = await getAdminPopularPosts('7d', new Date('2026-10-27T04:00:00Z'))
  expect(data.map(p => [p.id, p.periodViews])).toEqual([['b', 8], ['a', 5]])
  expect(prisma.postView.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ post: { status: 'PUBLISHED', deletedAt: null } }), take: 20 }))
})
