jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { getActor, requirePermission } from '@/server/auth/access'
import { withPermission } from '@/server/auth/route'

const user = (permissions: string[] = [], role = 'editor') => ({
  id: 'user-1', deletedAt: null,
  userRoles: [{ role: { name: role, rolePermissions: permissions.map(code => ({ permission: { code } })) } }],
})

beforeEach(() => jest.resetAllMocks())

test('absent sessions cannot load an actor', async () => {
  ;(auth as jest.Mock).mockResolvedValue(null)
  expect(await getActor()).toBeNull()
  expect(prisma.user.findUnique).not.toHaveBeenCalled()
})

test.each([null, { ...user(), deletedAt: new Date() }])('a stale token cannot authorize a missing/deleted user', async record => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(record)
  await expect(requirePermission('post:update')).rejects.toMatchObject({ status: 401 })
})

test('an explicit grant allows only that operation', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user(['post:update']))
  await expect(requirePermission('post:update')).resolves.toMatchObject({ id: 'user-1' })
  await expect(requirePermission('settings:update')).rejects.toMatchObject({ status: 403 })
})

test('revoking permission takes effect on the next request using the same token', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock)
    .mockResolvedValueOnce(user(['post:update']))
    .mockResolvedValueOnce(user([]))
  await expect(requirePermission('post:update')).resolves.toMatchObject({ id: 'user-1' })
  await expect(requirePermission('post:update')).rejects.toMatchObject({ status: 403 })
})

test('an existing admin role retains management access without a permission backfill', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user([], 'admin'))
  await expect(requirePermission('settings:update')).resolves.toMatchObject({ isAdmin: true })
})

test('a role supplied in the session cannot override database membership', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'admin' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user([], 'member'))
  await expect(requirePermission('post:delete')).rejects.toMatchObject({ status: 403 })
})

test('database errors fail closed and never invoke the protected operation', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('database unavailable'))
  const operation = jest.fn()
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const response = await withPermission('settings:update', operation)(new Request('http://localhost'), { params: {} })
  expect(response.status).toBe(500)
  expect(operation).not.toHaveBeenCalled()
  log.mockRestore()
})

test('protected responses cannot be cached and reused for another identity', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user(['post:read']))
  const response = await withPermission('post:read', async () => Response.json({ private: true }))(
    new Request('http://localhost'), { params: {} },
  )
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})
