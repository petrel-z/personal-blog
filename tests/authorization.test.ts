jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { getActor, requirePermission, requireAdminPermission } from '@/server/auth/access'
import { withPermission, withAdminPermission } from '@/server/auth/route'

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

test.each(['role:read', 'role:update', 'user:create', 'user:assign-role'] as const)(
  'only database admins receive the %s management capability', async permission => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user([permission, 'user:read']))
    expect((await getActor())?.permissions).toEqual(['user:read'])
    await expect(requirePermission(permission)).rejects.toMatchObject({ status: 403 })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user([], 'admin'))
    await expect(requirePermission(permission)).resolves.toMatchObject({ isAdmin: true })
  },
)

test('member grants never contribute backend permissions, including alongside another role', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  const member = user(['post:delete', 'user:create'], 'member')
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(member)
  expect((await getActor())?.permissions).toEqual([])
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    ...member, userRoles: [...member.userRoles, ...user(['post:read']).userRoles],
  })
  expect((await getActor())?.permissions).toEqual(['post:read'])
})

test('legacy roles retain their business grants but cannot gain management capabilities', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user(['post:read', 'user:read', 'role:update'], 'legacy-author'))
  expect((await getActor())?.permissions).toEqual(['post:read', 'user:read'])
})

test('the admin-only boundary checks membership even for an otherwise granted business permission', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'admin' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user(['user:read']))
  await expect(requireAdminPermission('user:read')).rejects.toMatchObject({ status: 403 })
})

test.each([
  { session: null, record: null, status: 401 },
  { session: { user: { id: 'user-1' } }, record: user(['user:read']), status: 403 },
  { session: { user: { id: 'user-1' } }, record: { ...user([], 'admin'), deletedAt: new Date() }, status: 401 },
])('admin routes reject with $status before parsing the request body', async ({ session, record, status }) => {
  ;(auth as jest.Mock).mockResolvedValue(session)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(record)
  const request = new Request('http://localhost', { method: 'POST', body: 'invalid JSON' })
  const response = await withAdminPermission('user:read', async req => {
    await req.json()
    return Response.json({ unexpected: true })
  })(request, { params: {} })
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(request.bodyUsed).toBe(false)
})

test('admin routes supply the current actor and stop authorizing after membership is revoked', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(user([], 'admin')).mockResolvedValueOnce(user(['user:read']))
  const route = withAdminPermission<{ params: { id: string } }>('user:read', async (_request, context, actor) =>
    Response.json({ actorId: actor.id, targetId: context.params.id }))
  const request = new Request('http://localhost')
  const response = await route(request, { params: { id: 'target' } })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ actorId: 'user-1', targetId: 'target' })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect((await route(request, { params: { id: 'target' } })).status).toBe(403)
})

test('admin routes fail closed on database failure without parsing the body', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('unavailable'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const request = new Request('http://localhost', { method: 'POST', body: 'invalid JSON' })
    const response = await withAdminPermission('user:read', async req => Response.json(await req.json()))(request, { params: {} })
    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(request.bodyUsed).toBe(false)
  } finally { log.mockRestore() }
})
