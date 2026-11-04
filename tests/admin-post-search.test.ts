jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { post: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() } } }))
import { prisma } from '@/server/db'
import { getPosts, getAdjacentPosts } from '@/server/features/post/post.service'
import type { Actor } from '@/server/auth/access'
const editor: Actor = { id: 'editor', isAdmin: false, permissions: ['post:read'] }
beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.post.count as jest.Mock).mockResolvedValue(21)
})
test('搜索与分页保留编辑者本人、分类、草稿和未删除范围', async () => {
  await getPosts({ admin: true, search: '  Markdown  ', status: 'DRAFT', categoryId: 'category', page: 2, pageSize: 10 }, editor)
  const where = { deletedAt: null, authorId: 'editor', status: 'DRAFT', categoryId: 'category', title: { contains: 'Markdown' } }
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10 }))
  expect(prisma.post.count).toHaveBeenCalledWith({ where })
})
test('公开搜索仍仅返回已发布文章', async () => {
  await getPosts({ search: '文章' })
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, status: 'PUBLISHED', title: { contains: '文章' } } }))
})
test('空白搜索不增加过滤条件，未授权后台搜索仍被拒绝', async () => {
  await getPosts({ search: '   ' })
  expect(prisma.post.count).toHaveBeenCalledWith({ where: { deletedAt: null, status: 'PUBLISHED' } })
  await expect(getPosts({ admin: true, search: '私密' })).rejects.toMatchObject({ status: 401 })
})

test('未分类文章的相邻查询使用可空字符串条件', async () => {
  ;(prisma.post.findFirst as jest.Mock).mockResolvedValue(null)
  await expect(getAdjacentPosts(null, 'post', new Date('2026-10-27T00:00:00Z'))).resolves.toEqual({ prev: null, next: null })
  for (const [query] of (prisma.post.findFirst as jest.Mock).mock.calls) {
    expect(query.where).toMatchObject({ categoryId: null, status: 'PUBLISHED', deletedAt: null })
  }
})
