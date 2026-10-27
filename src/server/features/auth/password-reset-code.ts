import { createHmac, randomInt } from 'node:crypto'
import { PasswordResetError } from './password-reset-error'

export function readResetCodeSecret(): string {
  const secret = process.env.AUTH_CODE_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 ||
      secret === process.env.AUTH_SECRET || secret === process.env.NEXTAUTH_SECRET) {
    throw new PasswordResetError('unavailable')
  }
  return secret
}

export function generateResetCode(): string {
  return String(randomInt(1_000_000)).padStart(6, '0')
}

export function hashResetCode(key: string, challengeId: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(['password-reset', key, challengeId, code].join('\0')).digest('hex')
}
