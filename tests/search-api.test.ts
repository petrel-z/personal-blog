jest.mock('@/server/db', () => ({ prisma: {
  post: { findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
} }))

import { prisma } from '@/server/db'
import { GET } from '@/app/api/search/route'

const post = {
  id: 'post-51', title: '接口权限设计', slug: 'permissions',
  summary: '文章简介', content: '前言 '.repeat(100) + '权限校验必须在服务端执行。' + '结语 '.repeat(100),
  coverImage: null, publishedAt: new Date('2026-10-20T00:00:00Z'),
  category: { id: 'category-1', name: '开发', slug: 'dev', deletedAt: null },
  tags: [{ id: 'tag-1', name: '权限', slug: 'permissions' }],
}

async function search(params: Record<string, string> = {}) {
  const response = await GET(new Request(`http://localhost/api/search?${new URLSearchParams(params)}`))
  return { response, body: await response.json() }
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([post])
  ;(prisma.post.count as jest.Mock).mockResolvedValue(51)
  ;(prisma.$transaction as jest.Mock).mockImplementation(queries => Promise.all(queries))
})

test.each<Record<string, string>>([
  {}, { keyword: '' }, { keyword: ' \t\n ' }, { keyword: '中'.repeat(101) },
  { keyword: '权限', page: '0' }, { keyword: '权限', page: '-1' },
  { keyword: '权限', page: '1.5' }, { keyword: '权限', page: 'NaN' },
  { keyword: '权限', page: '' }, { keyword: '权限', page: '1e2' },
  { keyword: '权限', page: '9007199254740992' },
  { keyword: '权限', page: '2147483647', pageSize: '20' },
  { keyword: '权限', pageSize: '0' }, { keyword: '权限', pageSize: '21' },
  { keyword: '权限', pageSize: '1.5' }, { keyword: '权限', pageSize: 'abc' },
])('rejects invalid query parameters before querying the database: %j', async params => {
  const { response, body } = await search(params)
  expect(response.status).toBe(400)
  expect(body.code).toBe(4000)
  expect(prisma.post.findMany).not.toHaveBeenCalled()
  expect(prisma.post.count).not.toHaveBeenCalled()
})

test('anonymous searches return a small, paginated public result without the full article', async () => {
  const { response, body } = await search({ keyword: ' 权限 ' })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(body).toMatchObject({ code: 2000, data: {
    total: 51, page: 1, pageSize: 10, totalPages: 6,
    items: [{ id: 'post-51', title: '接口权限设计', slug: 'permissions',
      publishedAt: '2026-10-20T00:00:00.000Z',
      category: { id: 'category-1', name: '开发', slug: 'dev' },
      tags: [{ id: 'tag-1', name: '权限', slug: 'permissions' }],
    }],
  } })
  const item = body.data.items[0]
  expect(item.excerpt).toContain('权限校验必须在服务端执行')
  expect(Array.from(item.excerpt).length).toBeLessThanOrEqual(162)
  expect(item).not.toHaveProperty('content')
  expect(item).not.toHaveProperty('author')
  expect(item.category).not.toHaveProperty('deletedAt')
})

test('article visibility is fixed for both the result list and count, including forged admin scope', async () => {
  await search({ keyword: '权限', status: 'DRAFT', scope: 'admin' })
  const query = (prisma.post.findMany as jest.Mock).mock.calls[0][0]
  expect(query.where).toEqual({
    status: 'PUBLISHED', deletedAt: null,
    OR: [
      { title: { contains: '权限' } },
      { summary: { contains: '权限' } },
      { content: { contains: '权限' } },
      { tags: { some: { deletedAt: null, name: { contains: '权限' } } } },
    ],
  })
  expect(prisma.post.count).toHaveBeenCalledWith({ where: query.where })
  expect(query.select.tags.where).toEqual({ deletedAt: null })
})

test('pagination happens in the database and can retrieve matches beyond the first 50 posts', async () => {
  const { body } = await search({ keyword: '权限', page: '6', pageSize: '10' })
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
    skip: 50, take: 10, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
  }))
  expect(body.data).toMatchObject({ page: 6, total: 51, totalPages: 6, items: [{ id: 'post-51' }] })
})

test.each([
  ['%', '\\%'], ['_', '\\_'], ['\\', '\\\\'], ['100%_\\', '100\\%\\_\\\\'],
  ['C++', 'C++'], ['[配置]', '[配置]'], ["' OR 1=1 --", "' OR 1=1 --"],
])('treats %s as a literal keyword passed to Prisma', async (keyword, pattern) => {
  const { response } = await search({ keyword })
  expect(response.status).toBe(200)
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ OR: expect.arrayContaining([
      { title: { contains: pattern } }, { content: { contains: pattern } },
    ]) }),
  }))
})

test('a no-match query returns an empty page successfully', async () => {
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.post.count as jest.Mock).mockResolvedValue(0)
  const { response, body } = await search({ keyword: '不存在的关键词' })
  expect(response.status).toBe(200)
  expect(body.data).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 })
})

test('an out-of-range page stays empty while preserving the matching total', async () => {
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
  const { body } = await search({ keyword: '权限', page: '7' })
  expect(body.data).toMatchObject({ items: [], total: 51, page: 7, totalPages: 6 })
})

test('deleted categories are omitted from the public result', async () => {
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([{ ...post,
    category: { ...post.category, deletedAt: new Date() },
  }])
  const { body } = await search({ keyword: '权限' })
  expect(body.data.items[0].category).toBeNull()
})

test('database failures return a genuine HTTP 500 without exposing database details', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    ;(prisma.post.findMany as jest.Mock).mockRejectedValue(new Error('private connection details'))
    const { response, body } = await search({ keyword: '权限' })
    expect(response.status).toBe(500)
    expect(body.code).toBe(5000)
    expect(body.data).toBeNull()
    expect(JSON.stringify(body)).not.toContain('private connection details')
  } finally { log.mockRestore() }
})
