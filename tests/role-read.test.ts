jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: {
  user: { findUnique: jest.fn() },
  role: { findMany: jest.fn(), create: jest.fn(), upsert: jest.fn() },
} }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/app/(admin)/admin/roles/_components/RoleManager', () => ({ __esModule: true, default: jest.fn() }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { redirect } from 'next/navigation'
import { PERMISSIONS, canAccessAdminPage } from '@/shared/permissions'
import { listRoles } from '@/server/features/auth/role.service'
import { GET } from '@/app/api/auth/roles/route'
import RolesPage from '@/app/(admin)/admin/roles/page'
import type { Actor } from '@/server/auth/access'

const admin: Actor = { id: 'admin-user', isAdmin: true, permissions: ['role:read'] }
const row = (name: string, codes: string[] = [], memberCount = 0) => ({
  id: `${name}-id`, name, description: name === 'editor' ? '现有角色说明' : null,
  _count: { userRoles: memberCount },
  rolePermissions: codes.map(code => ({ permission: { code } })),
})
const viewer = (name: string, codes: string[] = []) => ({
  id: 'viewer', sessionVersion: 0, deletedAt: null,
  userRoles: [{ role: { name, rolePermissions: codes.map(code => ({ permission: { code } })) } }],
})
const request = () => GET(new Request('http://localhost/api/auth/roles'), { params: {} })

beforeEach(() => {
  jest.resetAllMocks()
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'viewer', sessionVersion: 0 } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(viewer('admin'))
  ;(redirect as unknown as jest.Mock).mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) })
})

test('role summaries expose effective permissions, existing descriptions and active member counts', async () => {
  ;(prisma.role.findMany as jest.Mock).mockResolvedValue([
    row('reviewer', ['comment:read']), row('member', ['post:read']), row('admin'),
    row('editor', ['post:read', 'role:update', 'removed:permission'], 2),
  ])
  const roles = await listRoles(admin)
  expect(roles.map(role => role.name)).toEqual(['admin', 'editor', 'reviewer', 'member'])
  expect(roles[0].permissions).toEqual(PERMISSIONS)
  expect(roles[1]).toEqual({ id: 'editor-id', name: 'editor', description: '现有角色说明', memberCount: 2, permissions: ['post:read'] })
  expect(roles[2].permissions).toEqual(['comment:read'])
  expect(roles[3].permissions).toEqual([])
  expect(prisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { name: { in: ['admin', 'editor', 'reviewer', 'member'] } },
    select: expect.objectContaining({ _count: { select: { userRoles: { where: { user: { deletedAt: null } } } } } }),
  }))
})

test('missing roles remain missing and a read never initializes them', async () => {
  ;(prisma.role.findMany as jest.Mock).mockResolvedValue([row('admin')])
  expect((await listRoles(admin)).map(role => role.name)).toEqual(['admin'])
  ;(prisma.role.findMany as jest.Mock).mockResolvedValue([])
  expect(await listRoles(admin)).toEqual([])
  expect(prisma.role.create).not.toHaveBeenCalled()
  expect(prisma.role.upsert).not.toHaveBeenCalled()
})

test.each([
  { ...admin, isAdmin: false },
  { ...admin, permissions: [] },
])('the service rejects an actor missing administrator identity or the permission', async actor => {
  await expect(listRoles(actor)).rejects.toMatchObject({ status: 403 })
  expect(prisma.role.findMany).not.toHaveBeenCalled()
})

test.each([
  { session: null, record: null, status: 401, destination: '/login' },
  { session: { user: { id: 'viewer', sessionVersion: 0 } }, record: viewer('legacy-reader', ['user:read', 'role:read']), status: 403, destination: '/forbidden' },
])('API and server page deny unauthorized readers before role queries ($status)', async ({ session, record, status, destination }) => {
  ;(auth as jest.Mock).mockResolvedValue(session)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(record)
  const response = await request()
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect((await response.json()).data).toBeNull()
  await expect(RolesPage()).rejects.toThrow(`REDIRECT:${destination}`)
  expect(prisma.role.findMany).not.toHaveBeenCalled()
})

test('administrators can read through the API and enter the mapped server page', async () => {
  ;(prisma.role.findMany as jest.Mock).mockResolvedValue([row('admin')])
  const response = await request()
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ code: 2000, data: [{ name: 'admin', permissions: [...PERMISSIONS] }] })
  await expect(RolesPage()).resolves.toBeTruthy()
  expect(canAccessAdminPage(PERMISSIONS, '/admin/roles')).toBe(true)
  expect(canAccessAdminPage(['user:read'], '/admin/roles')).toBe(false)
})

test('role database failures return a private HTTP 500 without database details', async () => {
  ;(prisma.role.findMany as jest.Mock).mockRejectedValue(new Error('private database detail'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await request()
    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json()
    expect(body).toMatchObject({ code: 5000, data: null })
    expect(JSON.stringify(body)).not.toContain('private database detail')
  } finally { log.mockRestore() }
})
