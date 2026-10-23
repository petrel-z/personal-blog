import { createHmac } from 'node:crypto'

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function authDigest(purpose: string, value: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Authentication secret is not configured')
  return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest('hex')
}

export function emailKey(value: string) {
  return authDigest('login-email', normalizeEmail(value))
}
