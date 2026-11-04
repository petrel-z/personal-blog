import { timingSafeEqual } from 'node:crypto'
import type { PasswordResetChallenge } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { accountSchema } from '@/shared/validations/account'
import { authDigest, emailKey } from './identity'
import { consumeQuota } from './rate-limit.service'
import { hashResetCode, readResetCodeSecret } from './password-reset-code'
import { PasswordResetError } from './password-reset-error'
import { resetIpSchema } from './password-reset-input'

const confirmationSchema = z.object({
  email: accountSchema.shape.email,
  code: z.string().regex(/^\d{6}$/),
  newPassword: accountSchema.shape.password,
  ip: resetIpSchema,
})

export async function confirmPasswordReset(input: unknown): Promise<void> {
  const parsed = confirmationSchema.safeParse(input)
  if (!parsed.success) throw new PasswordResetError('invalid_confirmation')
  const { email, code, newPassword, ip } = parsed.data
  const secret = readResetCodeSecret()
  const key = emailKey(email)
  for (const [bucket, limit] of [
    [`reset:verify:ip:${authDigest('password-reset-ip', ip)}`, 100],
    [`reset:verify:email:${key}`, 20],
  ] as const) {
    const quota = await consumeQuota(bucket, limit, 900)
    if (!quota.allowed) throw new PasswordResetError('verification_limited', quota.retryAfterSeconds)
  }

  // Hash after quotas, but before locks, so bcrypt does not hold a database transaction.
  const password = await bcrypt.hash(newPassword, 10)
  const accepted = await prisma.$transaction(async tx => {
    const [challenge] = await tx.$queryRaw<PasswordResetChallenge[]>`
      SELECT * FROM PasswordResetChallenge WHERE emailKey = ${key} FOR UPDATE`
    if (!challenge || challenge.deliveryStatus !== 'SENT' || challenge.consumedAt ||
        challenge.expiresAt.getTime() <= Date.now() || challenge.failedAttempts >= 5 ||
        !challenge.userId || !challenge.codeHash || !/^[a-f0-9]{64}$/.test(challenge.codeHash)) return false

    const digest = hashResetCode(key, challenge.challengeId, code, secret)
    if (!timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(digest, 'hex'))) {
      const failedAttempts = challenge.failedAttempts + 1
      await tx.passwordResetChallenge.update({ where: { emailKey: key }, data: {
        failedAttempts, ...(failedAttempts >= 5 ? { codeHash: null } : {}),
      } })
      // Returning commits the failed-attempt count. Throw only after the transaction.
      return false
    }

    const [user] = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null }>>`
      SELECT id, deletedAt FROM User WHERE id = ${challenge.userId} AND email = ${email} FOR UPDATE`
    if (!user || user.deletedAt) return false
    await tx.user.update({ where: { id: user.id }, data: { password, sessionVersion: { increment: 1 } } })
    await tx.passwordResetChallenge.update({ where: { emailKey: key }, data: { codeHash: null, consumedAt: new Date() } })
    // A recovered account should be able to sign in with its new password immediately.
    await tx.loginAttempt.updateMany({ where: { key }, data: { failures: 0, lockedUntil: null } })
    return true
  }, { maxWait: 10_000, timeout: 10_000 })
  if (!accepted) throw new PasswordResetError('code')
}
