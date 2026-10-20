jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { post: {
  findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(),
}, tag: { findMany: jest.fn() } } }))

import { prisma } from '@/server/db'
import { createPost, updatePost, deletePost, getPosts } from '@/server/features/post/post.service'
import type { Actor } from '@/server/auth/access'
import { PERMISSIONS } from '@/shared/permissions'

const editor: Actor = { id: 'editor', isAdmin: false, permissions: ['post:read', 'post:create', 'post:update', 'post:delete'] }
const admin: Actor = { id: 'admin', isAdmin: true, permissions: [...PERMISSIONS] }
const member: Actor = { id: 'member', isAdmin: false, permissions: [] }
const draft = { id: 'post-1', authorId: 'editor', status: 'DRAFT', deletedAt: null }

beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue(draft)
  ;(prisma.post.update as jest.Mock).mockResolvedValue({ ...draft, title: 'Updated' })
  ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.post.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.tag.findMany as jest.Mock).mockResolvedValue([])
})

test('members cannot create articles through the business service', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue(null)
  await expect(createPost({ title: 'Title', content: 'Text' }, member)).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.create).not.toHaveBeenCalled()
})

test('creating a published article also requires publication permission', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue(null)
  await expect(createPost({ title: 'Title', content: 'Text', status: 'PUBLISHED' }, editor)).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.create).not.toHaveBeenCalled()
})

test('new draft authors come from the authorized actor', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue(null)
  await createPost({ title: 'Title', content: 'Text' }, editor)
  expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: 'editor', status: 'DRAFT' }) }))
})

test.each(['update', 'delete'])('editors cannot %s another author’s draft', async action => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue({ ...draft, authorId: 'other' })
  const operation = action === 'update' ? updatePost('post-1', { title: 'Changed' }, editor) : deletePost('post-1', editor)
  await expect(operation).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.update).not.toHaveBeenCalled()
})

test('draft-to-published changes require publication permission', async () => {
  await expect(updatePost('post-1', { status: 'PUBLISHED' }, editor)).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.update).not.toHaveBeenCalled()
})

test('editing existing published content also requires publication permission', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue({ ...draft, status: 'PUBLISHED' })
  await expect(updatePost('post-1', { content: 'Replaced content' }, editor)).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.update).not.toHaveBeenCalled()
})

test('editors can update their own drafts', async () => {
  await expect(updatePost('post-1', { title: 'Updated' }, editor)).resolves.toMatchObject({ title: 'Updated' })
  expect(prisma.post.update).toHaveBeenCalled()
})

test('administrators can edit another author’s published article', async () => {
  ;(prisma.post.findUnique as jest.Mock).mockResolvedValue({ ...draft, status: 'PUBLISHED' })
  await updatePost('post-1', { title: 'Updated' }, admin)
  expect(prisma.post.update).toHaveBeenCalled()
})

test('anonymous callers cannot query drafts through the service', async () => {
  await expect(getPosts({ status: 'DRAFT' })).rejects.toMatchObject({ status: 401 })
  expect(prisma.post.findMany).not.toHaveBeenCalled()
})

test('admin list scope limits editors to their own articles and includes drafts', async () => {
  await getPosts({ admin: true }, editor)
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, authorId: 'editor' } }))
})

test('ordinary visitors can still list published articles', async () => {
  await getPosts({})
  expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, status: 'PUBLISHED' } }))
})

test('a concurrent publish cannot let a draft-only editor overwrite published content', async () => {
  // The initial authorization read sees a draft, but the database has been
  // changed by a publisher before the write arrives. Emulate conditional writes.
  const stored: Record<string, unknown> = { ...draft, status: 'PUBLISHED', title: 'Original' }
  ;(prisma.post.update as jest.Mock).mockImplementation(({ where, data }) => {
    const matches = Object.entries(where).every(([key, value]) => stored[key] === value)
    if (!matches) return Promise.reject(new Error('Record no longer matches write condition'))
    Object.assign(stored, data)
    return Promise.resolve(stored)
  })
  await expect(updatePost('post-1', { title: 'Unauthorized edit' }, editor)).rejects.toThrow()
  expect(stored.title).toBe('Original')
})

test.each(['create', 'update'])('editors cannot create global tags through article %s', async action => {
  if (action === 'create') (prisma.post.findUnique as jest.Mock).mockResolvedValue(null)
  const operation = action === 'create'
    ? createPost({ title: 'Title', content: 'Text', tags: ['New tag'] }, editor)
    : updatePost('post-1', { tags: ['New tag'] }, editor)
  await expect(operation).rejects.toMatchObject({ status: 403 })
  expect(prisma.post.create).not.toHaveBeenCalled()
  expect(prisma.post.update).not.toHaveBeenCalled()
})

test('editors can attach existing tags to their own drafts without creating tags', async () => {
  ;(prisma.tag.findMany as jest.Mock).mockResolvedValue([{ name: 'Existing tag' }])
  await updatePost('post-1', { tags: ['Existing tag'] }, editor)
  const relation = (prisma.post.update as jest.Mock).mock.calls[0][0].data.tags
  expect(relation.connect).toEqual([{ name: 'Existing tag' }])
  expect(relation).not.toHaveProperty('connectOrCreate')
})

test('tag managers can create tags while saving an article', async () => {
  await updatePost('post-1', { tags: ['New tag'] }, admin)
  expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ tags: expect.objectContaining({
      connectOrCreate: [{ where: { name: 'New tag' }, create: { name: 'New tag', slug: 'new-tag' } }],
    }) }),
  }))
})
