jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn() } }))
jest.mock('@/server/features/auth/rate-limit.service', () => ({ consumeQuota: jest.fn() }))

import { prisma } from '@/server/db'
import { consumeQuota } from '@/server/features/auth/rate-limit.service'
import * as reset from '@/server/features/auth/password-reset.service'

const input = { email: 'owner@example.com', code: '001234', newPassword: 'New-password!', ip: '192.0.2.5' }
const previous = process.env.AUTH_CODE_SECRET
beforeEach(() => { jest.clearAllMocks(); process.env.AUTH_CODE_SECRET = 'reset-confirm-test-secret-at-least-32-bytes' })
afterAll(() => {
  if (previous === undefined) delete process.env.AUTH_CODE_SECRET
  else process.env.AUTH_CODE_SECRET = previous
})

test.each([
  { ...input, email: 'not-email' }, { ...input, code: '12345' }, { ...input, code: '１２３４５６' },
  { ...input, newPassword: 'short' }, { ...input, newPassword: '密'.repeat(25) },
])('malformed reset input is rejected before touching account data', async data => {
  await expect(reset.confirmPasswordReset(data)).rejects.toMatchObject({ reason: 'invalid_confirmation' })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test('confirmation quota exhaustion returns retry information before reading credentials', async () => {
  ;(consumeQuota as jest.Mock).mockResolvedValue({ allowed: false, retryAfterSeconds: 123 })
  await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'verification_limited', retryAfterSeconds: 123 })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test('missing signing configuration fails closed without consuming a code', async () => {
  delete process.env.AUTH_CODE_SECRET
  await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'unavailable' })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
