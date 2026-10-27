import { randomInt, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { prisma } from '../../src/server/db'
import { issueCaptcha } from '../../src/server/features/auth/captcha.service'
import { authDigest, emailKey } from '../../src/server/features/auth/identity'
import * as reset from '../../src/server/features/auth/password-reset.service'
import { createCaptureMailTransport } from '../helpers/capture-mail'
import { setupAuthorization } from '../../scripts/setup-auth'

async function executeDdl(sql: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'prisma', 'db', 'execute', '--stdin'], { env: process.env, stdio: ['pipe', 'ignore', 'ignore'] })
    child.stdin.end(sql); child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error('Test DDL failed')))
  })
}

const newPassword = 'Replacement-password-27!'
const emails: string[] = [], ips: string[] = [], captchaIds: string[] = []
function address() { const value = `consume-${randomUUID()}@example.com`; emails.push(value); return value }
function source() { const value = `198.19.${randomInt(256)}.${randomInt(1, 255)}`; ips.push(value); return value }
async function send(email: string, ip = source()) {
  const captcha = await issueCaptcha('password-reset'); captchaIds.push(captcha.id)
  const captchaCode = Array.from(captcha.svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g), match => match[1]).join('')
  const mail = createCaptureMailTransport()
  await reset.requestPasswordReset({ email, ip, captchaId: captcha.id, captchaCode }, { mail })
  return /验证码：(\d{6})/.exec(mail.messages[0].text)![1]
}
async function issued() {
  const user = await makeUser(address())
  return { user, email: user.email, code: await send(user.email), newPassword, ip: source() }
}
async function challenge(email: string) { return db.passwordResetChallenge.findUniqueOrThrow({ where: { emailKey: emailKey(email) } }) }
async function resend(email: string) {
  await db.passwordResetChallenge.update({ where: { emailKey: emailKey(email) }, data: { sentAt: new Date(Date.now() - 60_001) } })
  return send(email)
}
const wrong = (code: string) => code === '000000' ? '000001' : '000000'

test.afterEach(async () => {
  const keys = emails.map(emailKey)
  await db.passwordResetChallenge.deleteMany({ where: { emailKey: { in: keys } } })
  await db.authRateBucket.deleteMany({ where: { key: { in: [
    ...keys.flatMap(key => [`reset:send:email:${key}`, `reset:verify:email:${key}`]),
    ...ips.flatMap(ip => [`reset:send:ip:${authDigest('password-reset-ip', ip)}`, `reset:verify:ip:${authDigest('password-reset-ip', ip)}`]),
  ] } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: keys } } })
  await db.captchaChallenge.deleteMany({ where: { id: { in: captchaIds } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  emails.length = 0; ips.length = 0; captchaIds.length = 0
})
test.afterAll(async () => { await Promise.all([db.$disconnect(), prisma.$disconnect()]) })

test('HTTP reset consumes a sent code, changes the password and revokes existing admin sessions', async ({ request, playwright }) => {
  const input = await issued()
  await setupAuthorization(db, input.email)
  const captcha = await getCaptcha(request, 'login'); captchaIds.push(captcha.id)
  expect((await login(request, { email: input.email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })).searchParams.has('error')).toBe(false)
  expect((await request.get('/api/auth/users')).status()).toBe(200)
  await db.loginAttempt.update({ where: { key: emailKey(input.email) }, data: { failures: 5, lockedUntil: new Date(Date.now() + 900_000) } })
  const response = await request.post('/api/auth/password-reset/confirm', {
    data: { email: input.email.toUpperCase(), code: input.code, newPassword, ip: 'spoofed' },
    headers: { 'X-Forwarded-For': input.ip },
  })
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ code: 2000, data: null })
  expect(response.headers()['cache-control']).toBe('private, no-store')
  const user = await db.user.findUniqueOrThrow({ where: { id: input.user.id } })
  expect(user.sessionVersion).toBe(1)
  expect(await bcrypt.compare(newPassword, user.password)).toBe(true)
  expect(await bcrypt.compare(testPassword, user.password)).toBe(false)
  expect(await challenge(input.email)).toMatchObject({ codeHash: null, consumedAt: expect.any(Date) })
  expect((await request.get('/api/auth/users')).status()).toBe(401)
  expect(await (await request.get('/api/auth/session')).json()).toBeNull()
  expect(await db.loginAttempt.findUnique({ where: { key: emailKey(input.email) } })).toMatchObject({ failures: 0, lockedUntil: null })
  const fresh = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3017' })
  try {
    const old = await getCaptcha(fresh, 'login'); captchaIds.push(old.id)
    expect((await login(fresh, { email: input.email, password: testPassword, captchaId: old.id, captchaCode: old.code })).searchParams.get('error')).toBe('CredentialsSignin')
    const latest = await getCaptcha(fresh, 'login'); captchaIds.push(latest.id)
    expect((await login(fresh, { email: input.email, password: newPassword, captchaId: latest.id, captchaCode: latest.code })).searchParams.has('error')).toBe(false)
    expect((await fresh.get('/api/auth/users')).status()).toBe(200)
  } finally { await fresh.dispose() }
  await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'code' })
})

test('concurrent correct submissions update the password and session version only once', async () => {
  const input = await issued()
  const results = await Promise.allSettled([reset.confirmPasswordReset(input), reset.confirmPasswordReset(input)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  expect((await db.user.findUniqueOrThrow({ where: { id: input.user.id } })).sessionVersion).toBe(1)
})

test('five concurrent wrong codes commit their attempt counts and invalidate the challenge', async () => {
  const input = await issued()
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => reset.confirmPasswordReset({ ...input, code: wrong(input.code) })))
  expect(results.every(result => result.status === 'rejected')).toBe(true)
  expect(await challenge(input.email)).toMatchObject({ failedAttempts: 5, codeHash: null })
  await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'code' })
  const user = await db.user.findUniqueOrThrow({ where: { id: input.user.id } })
  expect(await bcrypt.compare(testPassword, user.password)).toBe(true)
  expect(user.sessionVersion).toBe(0)
})

for (const state of ['expired', 'pending', 'failed', 'consumed', 'bad-digest', 'deleted', 'rebound'] as const) {
  test(`${state} challenge cannot reset a password`, async () => {
    const input = await issued()
    if (state === 'deleted') await db.user.update({ where: { id: input.user.id }, data: { deletedAt: new Date() } })
    else if (state === 'rebound') {
      await db.user.delete({ where: { id: input.user.id } }); await makeUser(input.email)
    } else {
      const data = state === 'expired' ? { expiresAt: new Date(Date.now() - 1) }
        : state === 'pending' ? { deliveryStatus: 'PENDING' as const }
        : state === 'failed' ? { deliveryStatus: 'FAILED' as const }
        : state === 'consumed' ? { consumedAt: new Date() } : { codeHash: 'bad-digest' }
      await db.passwordResetChallenge.update({ where: { emailKey: emailKey(input.email) }, data })
    }
    await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'code' })
    expect(await bcrypt.compare(testPassword, (await db.user.findUniqueOrThrow({ where: { email: input.email } })).password)).toBe(true)
  })
}

test('resend rejects the old code and does not clear email verification quotas', async () => {
  const input = await issued()
  const latest = await resend(input.email)
  expect(latest).not.toBe(input.code)
  await expect(reset.confirmPasswordReset(input)).rejects.toMatchObject({ reason: 'code' })
  const key = `reset:verify:email:${emailKey(input.email)}`
  await db.authRateBucket.update({ where: { key }, data: { count: 20 } })
  await expect(reset.confirmPasswordReset({ ...input, code: latest, ip: source() })).rejects.toMatchObject({ reason: 'verification_limited' })
  expect((await db.user.findUniqueOrThrow({ where: { id: input.user.id } })).sessionVersion).toBe(0)
  expect((await challenge(input.email)).consumedAt).toBeNull()
})

test('one IP cannot exceed its last verification slot through concurrent unknown emails', async () => {
  const ip = source()
  const key = `reset:verify:ip:${authDigest('password-reset-ip', ip)}`
  await db.authRateBucket.create({ data: { key, count: 99, windowStart: new Date() } })
  const results = await Promise.allSettled([address(), address()].map(email => reset.confirmPasswordReset({ email, code: '000000', newPassword, ip })))
  expect(results.map(result => (result as PromiseRejectedResult).reason.reason).sort()).toEqual(['code', 'verification_limited'])
  expect((await db.authRateBucket.findUniqueOrThrow({ where: { key } })).count).toBe(100)
})

test('HTTP input and quota errors use safe uncached responses and server-derived IP', async ({ request }) => {
  const ip = source()
  const invalid = await request.post('/api/auth/password-reset/confirm', { data: { email: address(), code: '123456', newPassword: '密'.repeat(25) }, headers: { 'X-Forwarded-For': ip } })
  expect(invalid.status()).toBe(400)
  const key = `reset:verify:ip:${authDigest('password-reset-ip', ip)}`
  expect(await db.authRateBucket.findUnique({ where: { key } })).toBeNull()
  await db.authRateBucket.create({ data: { key, count: 100, windowStart: new Date() } })
  const response = await request.post('/api/auth/password-reset/confirm', { data: { email: address(), code: '123456', newPassword, ip: source() }, headers: { 'X-Forwarded-For': ip } })
  expect(response.status()).toBe(429)
  expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ code: 4290 })
})

test('a real database update failure rolls back password, version and code consumption', async ({ request }) => {
  const input = await issued()
  const name = 'f11_' + randomUUID().replaceAll('-', '')
  const sql = `CREATE TRIGGER \`${name}\` BEFORE UPDATE ON User FOR EACH ROW BEGIN IF OLD.id = '${input.user.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'private-reset-diagnostic'; END IF; END;`
  await executeDdl(sql)
  try {
    const response = await request.post('/api/auth/password-reset/confirm', { data: input, headers: { 'X-Forwarded-For': input.ip } })
    expect(response.status()).toBe(503)
    expect(await response.text()).not.toContain('private-reset-diagnostic')
    expect((await challenge(input.email)).consumedAt).toBeNull()
    const user = await db.user.findUniqueOrThrow({ where: { id: input.user.id } })
    expect(user.sessionVersion).toBe(0)
    expect(await bcrypt.compare(testPassword, user.password)).toBe(true)
  } finally { await executeDdl(`DROP TRIGGER IF EXISTS \`${name}\``) }
  await reset.confirmPasswordReset(input)
})
