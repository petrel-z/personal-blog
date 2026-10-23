jest.mock('@/server/features/auth/captcha.service', () => ({consumeCaptcha: jest.fn().mockResolvedValue(true)}))
jest.mock('@/server/features/auth/login-attempt.service', () => ({runLoginAttempt: async (_key: string, verify: () => Promise<unknown>) => { const user = await verify(); return user ? {kind:'success',user} : {kind:'invalid'} }}))
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => ({})), CredentialsSignin: class extends Error {code = 'credentials'} }))
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (config: unknown) => config }))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn().mockResolvedValue(true), hashSync: jest.fn(() => 'dummy') } }))

import NextAuth from 'next-auth'
import { prisma } from '@/server/db'
import { consumeCaptcha } from '@/server/features/auth/captcha.service'
import bcrypt from 'bcryptjs'
import '../auth'

const authorize = (NextAuth as jest.Mock).mock.calls[0][0].providers[0].authorize

test('deleted users cannot obtain a new session even with the correct password', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'deleted', email: 'deleted@example.com', password: '$2a$10$' + 'a'.repeat(53), deletedAt: new Date(),
  })
  expect(await authorize({ email: 'deleted@example.com', password: 'correct' })).toBeNull()
})

test('active users retain normal password login', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'active', email: 'active@example.com', name: 'Active', password: '$2a$10$' + 'a'.repeat(53), deletedAt: null,
  })
  expect(await authorize({ email: 'active@example.com', password: 'correct' })).toMatchObject({ id: 'active' })
})


test('missing or rejected captcha never checks the account or password', async () => {
  ;(consumeCaptcha as jest.Mock).mockResolvedValueOnce(false)
  ;(prisma.user.findUnique as jest.Mock).mockClear()
  ;(bcrypt.compare as jest.Mock).mockClear()
  await expect(authorize({email:'active@example.com', password:'correct'})).rejects.toMatchObject({code:'captcha'})
  expect(prisma.user.findUnique).not.toHaveBeenCalled()
  expect(bcrypt.compare).not.toHaveBeenCalled()
})
