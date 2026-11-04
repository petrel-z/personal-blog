jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => ({})), CredentialsSignin: class extends Error {} }))
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (config: unknown) => config }))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock('@/server/features/auth/captcha.service', () => ({ consumeCaptcha: async () => true }))
jest.mock('@/server/features/auth/login-attempt.service', () => ({ runLoginAttempt: async (_key: string, verify: () => Promise<unknown>) => ({ kind: 'success', user: await verify() }) }))
jest.mock('@/server/features/auth/registration.service', () => ({ registerMember: jest.fn(), RegistrationError: class extends Error {} }))
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn(), hashSync: () => 'dummy' } }))

import NextAuth from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'
import { registerMember } from '@/server/features/auth/registration.service'
import '../auth'

const config = (NextAuth as jest.Mock).mock.calls[0][0]
const account = { id: 'account', email: 'owner@example.com', name: 'Owner', deletedAt: null,
  password: '$2a$10$' + 'a'.repeat(53), sessionVersion: 0 }
beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...account })
  ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
})

test('login and registration carry the version captured with the verified password', async () => {
  const user = await config.providers[0].authorize({ email: account.email, password: 'valid-password' })
  expect(user).toMatchObject({ id: account.id, sessionVersion: 0 })
  ;(registerMember as jest.Mock).mockResolvedValue({ ...account, sessionVersion: 3 })
  expect(await config.providers[1].authorize({})).toMatchObject({ sessionVersion: 3 })
})

test('a current JWT remains valid and exposes its version to the server access boundary', async () => {
  const token = await config.callbacks.jwt({ token: {}, user: { ...account } })
  expect(token).toMatchObject({ id: account.id, sessionVersion: 0 })
  const session = await config.callbacks.session({ session: { user: {} }, token })
  expect(session.user).toMatchObject({ id: account.id, sessionVersion: 0 })
})

test.each([undefined, null, -1, 0.5, '0', Number.NaN])('missing or malformed version %s cannot retain a session', async sessionVersion => {
  expect(await config.callbacks.jwt({ token: { id: account.id, sessionVersion } })).toBeNull()
})

test.each([null, { ...account, deletedAt: new Date() }, { ...account, sessionVersion: 1 }])(
  'deleted, missing and password-reset accounts invalidate old JWTs', async record => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(record)
    expect(await config.callbacks.jwt({ token: { id: account.id, sessionVersion: 0 } })).toBeNull()
  },
)

test('client session updates cannot upgrade a stale token to the current version', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...account, sessionVersion: 1 })
  expect(await config.callbacks.jwt({ token: { id: account.id, sessionVersion: 0 }, trigger: 'update',
    session: { user: { id: account.id, sessionVersion: 1 }, sessionVersion: 1 } })).toBeNull()
})

test('an old password login racing a reset cannot receive the new version', async () => {
  ;(bcrypt.compare as jest.Mock).mockImplementationOnce(async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...account, sessionVersion: 1 })
    return true
  })
  const user = await config.providers[0].authorize({ email: account.email, password: 'old-password' })
  expect(user).toMatchObject({ sessionVersion: 0 })
  expect(await config.callbacks.jwt({ token: {}, user })).toBeNull()
})

test('database failure cannot keep a cached JWT authenticated or expose its diagnostics', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('private database diagnostic'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(await config.callbacks.jwt({ token: { id: account.id, sessionVersion: 0 } })).toBeNull()
    expect(JSON.stringify(log.mock.calls)).not.toContain('private database diagnostic')
  } finally { log.mockRestore() }
})
