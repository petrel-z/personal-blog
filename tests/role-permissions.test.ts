jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() }, $transaction: jest.fn() } }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { PATCH } from '@/app/api/auth/roles/[id]/permissions/route'
import { replaceRolePermissions } from '@/server/features/auth/role.service'
import { PERMISSIONS } from '@/shared/permissions'

const actor = { id: 'operator', isAdmin: true, permissions: PERMISSIONS }
let stored: string[]
let audit: { userId: string; target: string; action: string; details: string }[]
let tx: ReturnType<typeof transaction>
function transaction() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'admin' }]),
    user: { findUnique: jest.fn().mockResolvedValue({ id: actor.id, deletedAt: null, userRoles: [{ roleId: 'admin' }] }) },
    role: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'missing' ? null : {
      id: where.id, name: where.id, rolePermissions: stored.map(code => ({ permission: { code } })),
    })) },
    permission: {
      upsert: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.code, code: where.code })),
    },
    rolePermission: {
      deleteMany: jest.fn().mockImplementation(async () => { stored = [] }),
      createMany: jest.fn().mockImplementation(async ({ data }) => { stored = data.map((row: { permissionId: string }) => row.permissionId) }),
    },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }) => { audit.push(data) }) },
  }
}
function request(body: unknown, id = 'editor') {
  return PATCH(new Request(`http://localhost/api/auth/roles/${id}/permissions`, {
    method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }), { params: { id } })
}
beforeEach(() => {
  jest.resetAllMocks()
  stored = ['post:read', 'post:update']
  audit = []
  tx = transaction()
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: actor.id } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'admin', rolePermissions: [] } }] })
  ;(prisma.$transaction as jest.Mock).mockImplementation(operation => operation(tx))
})

test.each([401, 403])('denies unauthorized requests before parsing or changing permissions (%i)', async status => {
  if (status === 401) (auth as jest.Mock).mockResolvedValue(null)
  else (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'editor', rolePermissions: [{ permission: { code: 'role:update' } }] } }] })
  const response = await request('{')
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(stored).toEqual(['post:read', 'post:update'])
  expect(audit).toEqual([])
})

test.each([{}, null, { permissions: 'post:read' }, { permissions: ['post:read', 'post:read'] },
  { permissions: ['unknown:permission'] }, { permissions: [''] }, '{',
  ...['role:read', 'role:update', 'user:create', 'user:assign-role'].map(code => ({ permissions: [code] })),
])('rejects malformed or protected permission selections without changes: %p', async body => {
  expect((await request(body)).status).toBe(400)
  expect(stored).toEqual(['post:read', 'post:update'])
  expect(audit).toEqual([])
})

test.each(['admin', 'member', 'legacy'])('cannot change permissions of the protected or unsupported role %s', async id => {
  expect((await request({ permissions: [] }, id)).status).toBe(409)
  expect(stored).toEqual(['post:read', 'post:update'])
  expect(audit).toEqual([])
})

test('missing roles return 404 without writes', async () => {
  expect((await request({ permissions: ['post:read'] }, 'missing')).status).toBe(404)
  expect(stored).toEqual(['post:read', 'post:update'])
})

test.each(['editor', 'reviewer'])('replaces %s business permissions and audits actual before/after values', async id => {
  const response = await request({ permissions: ['comment:read', 'post:read'] }, id)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(stored.slice().sort()).toEqual(['comment:read', 'post:read'])
  expect(audit).toHaveLength(1)
  expect(audit[0]).toMatchObject({ userId: actor.id, target: id, action: 'ROLE_PERMISSION_UPDATE' })
  expect(JSON.parse(audit[0].details)).toEqual({ role: id,
    before: ['post:read', 'post:update'], after: ['comment:read', 'post:read'] })
})

test('identical selections are idempotent and an empty selection revokes all grants', async () => {
  expect((await request({ permissions: ['post:update', 'post:read'] })).status).toBe(200)
  expect(audit).toEqual([])
  expect((await request({ permissions: [] })).status).toBe(200)
  expect(stored).toEqual([])
  expect(audit).toHaveLength(1)
})

test('saving removes obsolete or accidentally stored administrator grants and audits the cleanup', async () => {
  stored = ['post:read', 'role:update', 'obsolete:permission']
  expect((await request({ permissions: ['post:read'] })).status).toBe(200)
  expect(stored).toEqual(['post:read'])
  expect(JSON.parse(audit[0].details).before).toEqual(['obsolete:permission', 'post:read', 'role:update'])
})

test('a revoked administrator cannot write after the transaction acquires its lock', async () => {
  tx.user.findUnique.mockResolvedValue({ id: actor.id, deletedAt: null, userRoles: [] })
  expect((await request({ permissions: [] })).status).toBe(403)
  expect(stored).toEqual(['post:read', 'post:update'])
  expect(audit).toEqual([])
})

test('direct service calls cannot bypass the administrator boundary or runtime validation', async () => {
  await expect(replaceRolePermissions({ ...actor, isAdmin: false }, 'editor', [])).rejects.toMatchObject({ status: 403 })
  await expect(replaceRolePermissions(actor, 'editor', ['role:update'])).rejects.toMatchObject({ status: 400 })
  expect(stored).toEqual(['post:read', 'post:update'])
})

test('audit failures are reported as private server errors rather than successful updates', async () => {
  tx.auditLog.create.mockRejectedValue(new Error('private-audit-error'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await request({ permissions: [] })
    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('private-audit-error')
  } finally { log.mockRestore() }
})
