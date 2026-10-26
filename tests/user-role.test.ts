jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() }, $transaction: jest.fn() } }))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { PATCH } from '@/app/api/auth/users/[id]/roles/route'
import { replaceUserRoles } from '@/server/features/auth/user.service'
import { withAdminTransaction } from '@/server/features/auth/admin-transaction'
import { PERMISSIONS } from '@/shared/permissions'

const actor = { id: 'operator', isAdmin: true, permissions: PERMISSIONS }
const role = (name: string) => ({ id: name, name })
let tx: ReturnType<typeof transaction>
function transaction() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'admin' }]),
    user: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'operator'
      ? { id: 'operator', deletedAt: null, userRoles: [{ roleId: 'admin' }] }
      : { id: 'target', deletedAt: null, userRoles: [{ roleId: 'member', role: role('member') }] })) },
    role: { findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(
      ['admin', 'editor', 'reviewer', 'member'].filter(id => where.id.in.includes(id)).map(role))) },
    userRole: { count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  }
}
function request(body: unknown, id = 'target') {
  return PATCH(new Request('http://localhost/api/auth/users/target/roles', {
    method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }), { params: { id } })
}
beforeEach(() => {
  jest.resetAllMocks()
  tx = transaction()
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: actor.id } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'admin', rolePermissions: [] } }] })
  ;(prisma.$transaction as jest.Mock).mockImplementation(operation => operation(tx))
})

test.each([401, 403])('authorization precedes parsing and role writes (%i)', async status => {
  if (status === 401) (auth as jest.Mock).mockResolvedValue(null)
  else (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'editor', rolePermissions: [{ permission: { code: 'user:assign-role' } }] } }] })
  const response = await request('{')
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test.each([{}, { roleIds: 'admin' }, { roleIds: ['editor', 'editor'] }, { roleIds: [''] },
  { roleIds: ['admin', 'editor', 'reviewer', 'member', 'extra'] }, '{'])('invalid input is rejected without mutation: %p', async body => {
  expect((await request(body)).status).toBe(400)
  expect(tx.userRole.deleteMany).not.toHaveBeenCalled()
  expect(tx.auditLog.create).not.toHaveBeenCalled()
})

test('unknown and legacy roles cannot be assigned', async () => {
  expect((await request({ roleIds: ['unknown'] })).status).toBe(400)
  tx.role.findMany.mockResolvedValue([role('legacy')])
  expect((await request({ roleIds: ['legacy'] })).status).toBe(400)
  expect(tx.userRole.deleteMany).not.toHaveBeenCalled()
})

test.each([null, { id: 'target', deletedAt: new Date(), userRoles: [] }])('missing and deleted targets return 404', async user => {
  const find = tx.user.findUnique.getMockImplementation()!
  tx.user.findUnique.mockImplementation(arg => arg.where.id === 'operator' ? find(arg) : Promise.resolve(user))
  expect((await request({ roleIds: [] })).status).toBe(404)
  expect(tx.userRole.deleteMany).not.toHaveBeenCalled()
})

test('the last active administrator cannot lose admin', async () => {
  tx.userRole.count.mockResolvedValue(1)
  tx.user.findUnique.mockResolvedValue({ id: 'operator', deletedAt: null,
    userRoles: [{ roleId: 'admin', role: role('admin') }] })
  const response = await request({ roleIds: ['member'] }, 'operator')
  expect(response.status).toBe(409)
  expect((await response.json()).message).toContain('最后')
  expect(tx.userRole.deleteMany).not.toHaveBeenCalled()
})

test('replacing roles writes one audit event with the authenticated actor and before/after', async () => {
  const response = await request({ roleIds: ['reviewer', 'editor'] })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'target' } })
  expect(tx.userRole.createMany).toHaveBeenCalledWith({ data: [
    { userId: 'target', roleId: 'editor' }, { userId: 'target', roleId: 'reviewer' },
  ] })
  const event = tx.auditLog.create.mock.calls[0][0].data
  expect(event).toMatchObject({ userId: actor.id, target: 'target', action: 'USER_ROLE_UPDATE' })
  expect(JSON.parse(event.details)).toEqual({ before: [role('member')], after: [role('editor'), role('reviewer')] })
})

test('ordinary users can have all roles removed; unchanged grants create no audit event', async () => {
  expect((await request({ roleIds: ['member'] })).status).toBe(200)
  expect(tx.auditLog.create).not.toHaveBeenCalled()
  expect((await request({ roleIds: [] })).status).toBe(200)
  expect(tx.userRole.createMany).not.toHaveBeenCalled()
  expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
})

test.each([null, { id: actor.id, deletedAt: new Date(), userRoles: [{ roleId: 'admin' }] },
  { id: actor.id, deletedAt: null, userRoles: [] }])('transaction rechecks revoked/deleted operators after acquiring the lock', async current => {
  tx.user.findUnique.mockResolvedValue(current)
  const operation = jest.fn()
  await expect(withAdminTransaction(actor, operation)).rejects.toHaveProperty('status')
  expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  expect(operation).not.toHaveBeenCalled()
})

test('the service refuses non-admin actors even outside a route', async () => {
  await expect(replaceUserRoles({ ...actor, isAdmin: false }, 'target', ['admin'])).rejects.toMatchObject({ status: 403 })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test('audit errors propagate through the transaction instead of reporting success', async () => {
  tx.auditLog.create.mockRejectedValue(new Error('audit write failed'))
  await expect(replaceUserRoles(actor, 'target', ['editor'])).rejects.toThrow('audit write failed')
})
