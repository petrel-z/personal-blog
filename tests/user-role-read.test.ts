jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn(), findMany: jest.fn() } } }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { GET } from '@/app/api/auth/users/route'

function actor(role: string, permissions: string[] = []) {
  return {
    id: 'viewer', deletedAt: null,
    userRoles: [{ role: { name: role, rolePermissions: permissions.map(code => ({ permission: { code } })) } }],
  }
}

const request = () => GET(new Request('http://localhost/api/auth/users'), { params: {} })

beforeEach(() => {
  jest.resetAllMocks()
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'viewer' } })
})

test.each([
  actor('admin'),
  actor('legacy-reader', ['user:read']),
])('authorized readers receive role summaries while existing user fields remain available', async viewer => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(viewer)
  const profile = {
    id: 'target', name: 'Example', email: 'target@example.com', image: null,
    createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-02'), _count: { posts: 2 },
  }
  const roles = [{ id: 'editor-id', name: 'editor' }, { id: 'legacy-id', name: 'legacy-writer' }]
  ;(prisma.user.findMany as jest.Mock).mockResolvedValue([
    { ...profile, userRoles: roles.map(role => ({ role })) },
    { ...profile, id: 'unassigned', userRoles: [] },
  ])

  const response = await request()
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const body = await response.json()
  expect(body.code).toBe(2000)
  expect(body.data).toEqual([
    { ...profile, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString(), roles },
    { ...profile, id: 'unassigned', createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString(), roles: [] },
  ])
  const query = (prisma.user.findMany as jest.Mock).mock.calls[0][0]
  expect(query.where).toEqual({ deletedAt: null })
  expect(query.select).not.toHaveProperty('password')
  expect(query.select.userRoles.select.role.select).toEqual({ id: true, name: true })
})

test.each([
  { session: null, viewer: null, status: 401 },
  { session: { user: { id: 'viewer' } }, viewer: actor('editor', ['post:read']), status: 403 },
])('unauthorized readers get $status before querying the user list', async ({ session, viewer, status }) => {
  ;(auth as jest.Mock).mockResolvedValue(session)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(viewer)
  const response = await request()
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(prisma.user.findMany).not.toHaveBeenCalled()
})

test('list query failures return HTTP 500 without exposing database details', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(actor('admin'))
  ;(prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('private database detail'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await request()
    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({ code: 5000, message: '获取用户列表失败', data: null })
  } finally { log.mockRestore() }
})
