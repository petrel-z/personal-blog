import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/server/db'
import type { MailTransport } from '@/server/mail/types'
import { createMailTransport } from '@/server/mail/transport'
import { buildResetCodeMail } from '@/server/mail/templates'
import { consumeCaptcha } from './captcha.service'
import { authDigest, emailKey, normalizeEmail } from './identity'
import { consumeQuota } from './rate-limit.service'
import { generateResetCode, hashResetCode, readResetCodeSecret } from './password-reset-code'
import { PasswordResetError } from './password-reset-error'
import { resetIpSchema } from './password-reset-input'

export { confirmPasswordReset } from './password-reset-confirm.service'

const requestSchema = z.object({
  email: z.string().trim().email().max(254).transform(normalizeEmail),
  captchaId: z.string().min(1).max(64),
  captchaCode: z.string().regex(/^[a-z0-9]{4}$/i),
  ip: resetIpSchema,
})

const resendSeconds = 60
const lifetimeMs = 10 * 60_000

export async function requestPasswordReset(input: unknown, deps: { mail?: MailTransport } = {}) {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) throw new PasswordResetError('invalid')
  const { email, captchaId, captchaCode, ip } = parsed.data
  if (!await consumeCaptcha({ id: captchaId, code: captchaCode, purpose: 'password-reset' })) {
    throw new PasswordResetError('captcha')
  }
  const secret = readResetCodeSecret()
  const key = emailKey(email)
  // Charge valid attempts (including cooldown retries) equally for all addresses.
  for (const [bucket, limit] of [
    [`reset:send:ip:${authDigest('password-reset-ip', ip)}`, 20],
    [`reset:send:email:${key}`, 5],
  ] as const) {
    const quota = await consumeQuota(bucket, limit, 3600)
    if (!quota.allowed) throw new PasswordResetError('limited', quota.retryAfterSeconds)
  }

  let mail: MailTransport
  try {
    mail = deps.mail ?? createMailTransport()
    // Check even unknown addresses so global outages cannot reveal account existence.
    await mail.verify()
  } catch { throw new PasswordResetError('unavailable') }

  const challengeId = randomUUID()
  const code = generateResetCode()
  const digest = hashResetCode(key, challengeId, code, secret)
  const recipient = await prisma.$transaction(async tx => {
    const epoch = new Date(0)
    // Atomic insert also locks an existing row, avoiding a first-request insert race.
    await tx.$executeRaw`INSERT INTO PasswordResetChallenge
      (emailKey, challengeId, expiresAt, sentAt, deliveryStatus)
      VALUES (${key}, ${challengeId}, ${epoch}, ${epoch}, 'FAILED')
      ON DUPLICATE KEY UPDATE emailKey = VALUES(emailKey)`
    const [current] = await tx.$queryRaw<Array<{ sentAt: Date }>>`
      SELECT sentAt FROM PasswordResetChallenge WHERE emailKey = ${key} FOR UPDATE`
    const now = new Date()
    const retryAfterSeconds = Math.ceil((current.sentAt.getTime() + resendSeconds * 1000 - now.getTime()) / 1000)
    if (retryAfterSeconds > 0) throw new PasswordResetError('limited', retryAfterSeconds)
    const user = await tx.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, email: true } })
    await tx.passwordResetChallenge.update({ where: { emailKey: key }, data: {
      challengeId, userId: user?.id ?? null, codeHash: user ? digest : null,
      sentAt: now, expiresAt: new Date(now.getTime() + lifetimeMs),
      failedAttempts: 0, consumedAt: null, deliveryStatus: 'PENDING',
    } })
    return user
  }, { maxWait: 10_000, timeout: 10_000 })

  let delivered = false
  if (recipient) {
    try {
      await mail.send({ to: recipient.email, ...buildResetCodeMail(code) })
      delivered = true
    } catch {
      // All post-preflight delivery failures share the public response, even outages.
      console.warn('Password reset mail delivery failed')
    }
  }
  // SMTP is outside the transaction. A delayed result may only finalize its own challenge.
  await prisma.passwordResetChallenge.updateMany({
    where: { emailKey: key, challengeId, deliveryStatus: 'PENDING' },
    data: delivered ? { deliveryStatus: 'SENT' } : { deliveryStatus: 'FAILED', codeHash: null },
  })
  return { message: '如果该邮箱已注册，你将收到验证码', retryAfterSeconds: resendSeconds }
}
