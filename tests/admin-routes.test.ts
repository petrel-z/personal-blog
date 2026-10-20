/** These tests call real HTTP handlers; only session, database and storage are replaced. */
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => {
  const models = ['user', 'post', 'postView', 'postLike', 'category', 'tag', 'comment', 'sensitiveWord', 'settings', 'auditLog']
  const methods = ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'create', 'update', 'delete', 'deleteMany', 'upsert']
  const prisma = Object.fromEntries(models.map(model => [model, Object.fromEntries(methods.map(method => [method, jest.fn()]))]))
  return { prisma: { ...prisma, $transaction: jest.fn() } }
})
jest.mock('fs/promises', () => ({ writeFile: jest.fn(), mkdir: jest.fn() }))
jest.mock('ali-oss', () => jest.fn())

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { writeFile } from 'fs/promises'

const routes = [
  ['posts/route', 'POST'],
  ['posts/[id]/route', 'PATCH'],
  ['posts/[id]/route', 'DELETE'],
  ['categories/route', 'POST'],
  ['categories/[id]/route', 'PUT'],
  ['categories/[id]/route', 'DELETE'],
  ['tags/route', 'POST'],
  ['tags/[id]/route', 'PUT'],
  ['tags/[id]/route', 'DELETE'],
  ['comments/admin/route', 'GET'],
  ['comments/[id]/route', 'GET'],
  ['comments/[id]/route', 'DELETE'],
  ['comments/[id]/moderate/route', 'PUT'],
  ['sensitive-words/route', 'GET'],
  ['sensitive-words/route', 'POST'],
  ['sensitive-words/[id]/route', 'PUT'],
  ['sensitive-words/[id]/route', 'DELETE'],
  ['settings/route', 'PUT'],
  ['auth/users/route', 'GET'],
  ['audit-logs/route', 'GET'],
  ['upload/route', 'POST'],
] as const

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  ;(prisma.$transaction as jest.Mock).mockImplementation(operations => Promise.all(operations))
})
afterEach(() => jest.restoreAllMocks())

describe.each([
  ['visitor', null, 401, 4010],
  ['member', { user: { id: 'member' } }, 403, 4030],
] as const)('%s management access', (_name, session, status, code) => {
  test.each(routes)('%s %s denies before parsing the body or performing effects', async (route, method) => {
    ;(auth as jest.Mock).mockResolvedValue(session)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'member', deletedAt: null, userRoles: [] })
    const handler = require(`../src/app/api/${route}`)[method]
    const response = await handler(new Request('http://localhost/api/test', {
      method,
      // A protected request must reject access even when its body is malformed.
      ...(method !== 'GET' ? { body: '{invalid', headers: { 'Content-Type': 'application/json' } } : {}),
    }), { params: { id: 'post-1' } })

    expect(response.status).toBe(status)
    expect((await response.json()).code).toBe(code)
    for (const model of Object.values(prisma)) {
      if (typeof model !== 'object') continue
      for (const mutation of ['create', 'update', 'delete', 'deleteMany', 'upsert']) {
        expect((model as Record<string, jest.Mock>)[mutation]).not.toHaveBeenCalled()
      }
    }
    expect(writeFile).not.toHaveBeenCalled()
  })
})

test('a settings administrator can update settings', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'admin' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'admin', deletedAt: null,
    userRoles: [{ role: { name: 'admin', rolePermissions: [] } }],
  })
  ;(prisma.settings.upsert as jest.Mock).mockResolvedValue({ key: 'blogName', value: 'Updated' })
  const { PUT } = require('../src/app/api/settings/route')
  const response = await PUT(new Request('http://localhost/api/settings', {
    method: 'PUT', body: JSON.stringify({ blogName: 'Updated' }),
  }))
  expect(response.status).toBe(200)
  expect((await response.json()).code).toBe(2000)
  expect(prisma.settings.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { key: 'blogName' }, update: { value: 'Updated' },
  }))
})

test.each(['categories', 'tags'])('public %s list remains available without a session', async route => {
  ;(prisma.category.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.tag.findMany as jest.Mock).mockResolvedValue([])
  const response = await require(`../src/app/api/${route}/route`).GET()
  expect(response.status).toBe(200)
  expect((await response.json()).code).toBe(2000)
  expect(auth).not.toHaveBeenCalled()
})

test('approval-only reviewers cannot reject a comment', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'reviewer' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'reviewer', deletedAt: null, userRoles: [{ role: {
      name: 'reviewer', rolePermissions: [{ permission: { code: 'comment:approve' } }],
    } }],
  })
  const { PUT } = require('../src/app/api/comments/[id]/moderate/route')
  const response = await PUT(new Request('http://localhost/api/comments/comment-1/moderate', {
    method: 'PUT', body: JSON.stringify({ action: 'reject' }),
  }), { params: { id: 'comment-1' } })
  expect(response.status).toBe(403)
  expect(prisma.comment.update).not.toHaveBeenCalled()
})

test('an authorized review records the authenticated actor', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'reviewer' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'reviewer', deletedAt: null, userRoles: [{ role: {
      name: 'reviewer', rolePermissions: [{ permission: { code: 'comment:approve' } }],
    } }],
  })
  ;(prisma.comment.findUnique as jest.Mock).mockResolvedValue({ content: 'Comment', nickname: 'Reader' })
  ;(prisma.comment.update as jest.Mock).mockResolvedValue({ id: 'comment-1', status: 'APPROVED' })
  const { PUT } = require('../src/app/api/comments/[id]/moderate/route')
  const response = await PUT(new Request('http://localhost/api/comments/comment-1/moderate', {
    method: 'PUT', body: JSON.stringify({ action: 'approve', userId: 'forged-admin' }),
  }), { params: { id: 'comment-1' } })
  expect((await response.json()).code).toBe(2000)
  expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'reviewer' }) }))
})

test('a draft preview is rejected before recording a view', async () => {
  ;(auth as jest.Mock).mockResolvedValue(null)
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', authorId: 'author', status: 'DRAFT', deletedAt: null })
  const { GET } = require('../src/app/api/posts/[id]/route')
  const response = await GET(new Request('http://localhost/api/posts/post-1'), { params: { id: 'post-1' } })
  expect(response.status).toBe(401)
  expect(prisma.postView.create).not.toHaveBeenCalled()
  expect(prisma.post.update).not.toHaveBeenCalled()
})

test('public article responses still include the newly recorded view', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue({
    id: 'post-1', authorId: 'author', status: 'PUBLISHED', deletedAt: null,
    categoryId: 'category-1', publishedAt: new Date(), viewCount: 10,
  })
  ;(prisma.postView.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.post.update as jest.Mock).mockResolvedValue({ viewCount: 11 })
  const { GET } = require('../src/app/api/posts/[id]/route')
  const response = await GET(new Request('http://localhost/api/posts/post-1'), { params: { id: 'post-1' } })
  expect((await response.json()).data.viewCount).toBe(11)
  expect(auth).not.toHaveBeenCalled()
})
