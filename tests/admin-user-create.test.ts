jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() }, $transaction: jest.fn() } }))

import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { POST } from '@/app/api/auth/users/route'
import { createManagedUser } from '@/server/features/auth/user.service'
import { registerSchema } from '@/shared/validations'
import { PERMISSIONS } from '@/shared/permissions'

const actor = { id: 'operator', isAdmin: true, permissions: PERMISSIONS }
const input = { name: 'New user', email: 'new@example.com', password: 'Strong-password!', roleIds: ['member'] }
let users: { id: string; name: string; email: string; password: string; userRoles: { create: { roleId: string }[] } }[]
let audits: { action: string; userId: string; target: string; details: string }[]
let tx: ReturnType<typeof transaction>
function transaction() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'admin' }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === actor.id
        ? { id: actor.id, deletedAt: null, userRoles: [{ roleId: 'admin' }] }
        : users.find(user => user.email === where.email) ?? null)),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const user = { id: 'new-user', ...data }
        users.push(user)
        return { id: user.id, email: user.email }
      }),
    },
    role: { findMany: jest.fn().mockImplementation(async ({ where }) => where.id.in
      .filter((id: string) => ['admin', 'editor', 'reviewer', 'member', 'legacy'].includes(id))
      .map((id: string) => ({ id, name: id }))) },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }) => { audits.push(data) }) },
  }
}
function request(body: unknown) {
  return POST(new Request('http://localhost/api/auth/users', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }), { params: {} })
}
beforeEach(() => {
  jest.resetAllMocks()
  users = []
  audits = []
  tx = transaction()
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: actor.id } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'admin', rolePermissions: [] } }] })
  ;(prisma.$transaction as jest.Mock).mockImplementation(operation => operation(tx))
})

test.each([401, 403])('creation denies unauthorized callers before parsing (%i)', async status => {
  if (status === 401) (auth as jest.Mock).mockResolvedValue(null)
  else (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: actor.id, deletedAt: null,
    userRoles: [{ role: { name: 'editor', rolePermissions: [{ permission: { code: 'user:create' } }] } }] })
  const response = await request('{')
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(users).toEqual([])
})

test.each([{}, null, '{', ...[
  { name: '   ' }, { name: 'a'.repeat(51) }, { email: 'invalid' }, { password: '12345' },
  { password: 'a'.repeat(73) }, { password: '中'.repeat(25) }, { password: '😀'.repeat(19) },
  { roleIds: [] }, { roleIds: ['member', 'member'] }, { roleIds: ['unknown'] },
  { roleIds: ['legacy'] }, { roleIds: 'admin' }, { roleIds: ['admin', 'editor', 'reviewer', 'member', 'extra'] },
].map(change => ({ ...input, ...change }))])('invalid account or role selection leaves no user: %p', async body => {
  expect((await request(body)).status).toBe(400)
  expect(users).toEqual([])
  expect(audits).toEqual([])
})

test('creates the account with selected roles, a verifiable hash and a safe audit/response', async () => {
  const response = await request({ ...input, name: ' New user ', email: ' NEW@Example.COM ', roleIds: ['reviewer', 'editor'] })
  expect(response.status).toBe(201)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response.headers.get('Set-Cookie')).toBeNull()
  expect((await response.json()).data).toEqual({ id: 'new-user', email: 'new@example.com' })
  expect(users).toHaveLength(1)
  expect(users[0].name).toBe('New user')
  expect(await bcrypt.compare(input.password, users[0].password)).toBe(true)
  expect(users[0].userRoles.create.map(role => role.roleId).sort()).toEqual(['editor', 'reviewer'])
  expect(audits).toHaveLength(1)
  expect(audits[0]).toMatchObject({ userId: actor.id, target: 'new-user', action: 'USER_CREATE' })
  expect(JSON.parse(audits[0].details)).toEqual({ email: 'new@example.com', roles: [
    { id: 'editor', name: 'editor' }, { id: 'reviewer', name: 'reviewer' },
  ] })
  expect(JSON.stringify(audits)).not.toContain(input.password)
  expect(JSON.stringify(audits)).not.toContain(users[0].password)
})

test.each(['a'.repeat(72), '中'.repeat(24), '😀'.repeat(18)])('accepts a password of exactly 72 UTF-8 bytes', async password => {
  expect((await request({ ...input, password })).status).toBe(201)
  expect(await bcrypt.compare(password, users[0].password)).toBe(true)
})

test('database email conflicts return 409', async () => {
  tx.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Duplicate email', {
    code: 'P2002', clientVersion: '5.22.0', meta: { target: 'User_email_key' },
  }))
  expect((await request(input)).status).toBe(409)
  expect(users).toEqual([])
  expect(audits).toEqual([])
})

test('an operator revoked while waiting for the transaction cannot create a user', async () => {
  tx.user.findUnique.mockResolvedValue({ id: actor.id, deletedAt: null, userRoles: [] })
  expect((await request(input)).status).toBe(403)
  expect(users).toEqual([])
})

test('direct service calls enforce administrator authorization', async () => {
  await expect(createManagedUser({ ...actor, isAdmin: false }, input)).rejects.toMatchObject({ status: 403 })
  expect(users).toEqual([])
})

test('unexpected database failures expose neither credentials nor database diagnostics to logs or clients', async () => {
  const secretDiagnostic = `Database failure: ${input.password} $2a$10$private-hash`
  tx.user.create.mockRejectedValue(new Error(secretDiagnostic))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await request(input)
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain(input.password)
    expect(JSON.stringify(log.mock.calls)).not.toContain(secretDiagnostic)
  } finally { log.mockRestore() }
})

test.each(['a'.repeat(73), '中'.repeat(25), '😀'.repeat(19)])('public registration form also rejects passwords exceeding the byte limit', password => {
  const parsed = registerSchema.safeParse({ ...input, password, confirmPassword: password, captcha: 'ABCD' })
  expect(parsed.success).toBe(false)
  if (!parsed.success) expect(parsed.error.flatten().fieldErrors.password?.[0]).toContain('72字节')
})
