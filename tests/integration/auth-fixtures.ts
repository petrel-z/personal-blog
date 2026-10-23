import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import type { APIRequestContext } from '@playwright/test'

const url = process.env.AUTH_TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_auth_test') || process.env.DATABASE_URL !== url) {
  throw new Error('Refusing to run auth fixtures outside the explicit isolated test database')
}
export const db = new PrismaClient({ datasources: { db: { url } }, log: [] })
export const testPassword = 'PhaseOne-Valid-Password!'

export async function makeUser(email: string) {
  return db.user.create({ data: { email, password: await bcrypt.hash(testPassword, 10), name: 'Auth test' } })
}

export async function getCaptcha(request: APIRequestContext, purpose: string) {
  const response = await request.get(`/api/captcha?purpose=${purpose}`)
  const svg = await response.text()
  const code = Array.from(svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g), match => match[1]).join('')
  return { id: response.headers()['x-captcha-id'], code, status: response.status() }
}

export async function login(request: APIRequestContext, credentials: Record<string, string>) {
  const { csrfToken } = await (await request.get('/api/auth/csrf')).json()
  const response = await request.post('/api/auth/callback/credentials', {
    headers: { 'X-Auth-Return-Redirect': '1' }, form: { csrfToken, ...credentials },
  })
  const {url} = await response.json()
  return new URL(url)
}
