jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => ({})) }))
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (config: unknown) => config }))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn() }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn().mockResolvedValue(true) } }))

import NextAuth from 'next-auth'
import { prisma } from '@/server/db'
import '../auth'

const authorize = (NextAuth as jest.Mock).mock.calls[0][0].providers[0].authorize

test('deleted users cannot obtain a new session even with the correct password', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'deleted', email: 'deleted@example.com', password: 'hash', deletedAt: new Date(),
  })
  expect(await authorize({ email: 'deleted@example.com', password: 'correct' })).toBeNull()
})

test('active users retain normal password login', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: 'active', email: 'active@example.com', name: 'Active', password: 'hash', deletedAt: null,
  })
  expect(await authorize({ email: 'active@example.com', password: 'correct' })).toMatchObject({ id: 'active' })
})
