import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/server/db'
import { isCaptchaPurpose, type CaptchaPurpose } from '@/shared/types/auth'
import { authDigest } from './identity'

export async function issueCaptcha(purpose: CaptchaPurpose): Promise<{ id: string; svg: string }> {
  if (!isCaptchaPurpose(purpose)) throw new Error('Invalid captcha purpose')
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')
  const id = randomUUID()
  const now = new Date()
  await prisma.captchaChallenge.deleteMany({ where: { expiresAt: { lte: now } } })
  await prisma.captchaChallenge.create({ data: {
    id, purpose, codeHash: authDigest('captcha', `${id}:${purpose}:${code}`),
    expiresAt: new Date(now.getTime() + 5 * 60_000),
  } })
  const chars = code.split('').map((char, i) => {
    const x = 16 + i * 29
    return `<text x="${x}" y="29" font-size="27" font-family="monospace" text-anchor="middle" fill="#286496" transform="rotate(${randomInt(-12, 13)} ${x} 24)">${char}</text>`
  }).join('')
  return { id, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" fill="#f0f4f8"/><path d="M0 12L120 30M0 32L120 8" stroke="#cbd5e1"/>${chars}</svg>` }
}

export async function consumeCaptcha(input: { id: string; code: string; purpose: CaptchaPurpose }): Promise<boolean> {
  if (typeof input.id !== 'string' || input.id.length > 64 || !input.id ||
      typeof input.code !== 'string' || !/^[a-z0-9]{4}$/i.test(input.code) || !isCaptchaPurpose(input.purpose)) return false
  const digest = authDigest('captcha', `${input.id}:${input.purpose}:${input.code.toUpperCase()}`)
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ purpose: string; codeHash: string; expiresAt: Date }>>`
      SELECT purpose, codeHash, expiresAt FROM CaptchaChallenge WHERE id = ${input.id} FOR UPDATE`
    const challenge = rows[0]
    if (!challenge || challenge.purpose !== input.purpose) return false
    await tx.captchaChallenge.delete({ where: { id: input.id } })
    return challenge.expiresAt.getTime() > Date.now() &&
      challenge.codeHash.length === digest.length &&
      timingSafeEqual(Buffer.from(challenge.codeHash), Buffer.from(digest))
  })
}
