import { createHmac, randomInt, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { db, getCaptcha, makeUser } from './auth-fixtures'
import { prisma } from '../../src/server/db'
import { issueCaptcha } from '../../src/server/features/auth/captcha.service'
import { authDigest, emailKey } from '../../src/server/features/auth/identity'
import { requestPasswordReset } from '../../src/server/features/auth/password-reset.service'
import { createCaptureMailTransport } from '../helpers/capture-mail'
import { startCaptureSmtp } from '../helpers/capture-smtp'
import { MailError, type MailTransport } from '../../src/server/mail/types'

const secret = 'isolated-password-reset-secret-32-bytes-minimum'
const emails: string[] = []
const ips: string[] = []
const captchaIds: string[] = []
const previousSecret = process.env.AUTH_CODE_SECRET
function email() { const value = `reset-${randomUUID()}@example.com`; emails.push(value); return value }
function ip() { const value = `198.18.${randomInt(256)}.${randomInt(1, 255)}`; ips.push(value); return value }
async function input(address: string, source = ip(), purpose: 'password-reset' | 'login' = 'password-reset') {
  const captcha = await issueCaptcha(purpose)
  captchaIds.push(captcha.id)
  return { email: address, ip: source, captchaId: captcha.id,
    captchaCode: Array.from(captcha.svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g), match => match[1]).join('') }
}
async function row(address: string) { return db.passwordResetChallenge.findUniqueOrThrow({ where: { emailKey: emailKey(address) } }) }
async function allowResend(address: string) {
  await db.passwordResetChallenge.update({ where: { emailKey: emailKey(address) }, data: { sentAt: new Date(Date.now() - 60_001) } })
}
function code(text: string) { return /验证码：(\d{6})/.exec(text)![1] }
test.beforeEach(() => { process.env.AUTH_CODE_SECRET = secret })
test.afterEach(async () => {
  await db.passwordResetChallenge.deleteMany({ where: { emailKey: { in: emails.map(emailKey) } } })
  await db.authRateBucket.deleteMany({ where: { key: { in: [
    ...emails.map(value => `reset:send:email:${emailKey(value)}`),
    ...ips.map(value => `reset:send:ip:${authDigest('password-reset-ip', value)}`),
  ] } } })
  await db.captchaChallenge.deleteMany({ where: { id: { in: captchaIds } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  emails.length = 0; ips.length = 0; captchaIds.length = 0
  if (previousSecret === undefined) delete process.env.AUTH_CODE_SECRET
  else process.env.AUTH_CODE_SECRET = previousSecret
})
test.afterAll(async () => { await Promise.all([db.$disconnect(), prisma.$disconnect()]) })

test('issuance sends one six-digit code and stores only a user-bound digest valid for ten minutes', async () => {
  const user = await makeUser(email())
  const mail = createCaptureMailTransport()
  const before = Date.now()
  const result = await requestPasswordReset(await input(` ${user.email.toUpperCase()} `), { mail })
  expect(result).toEqual({ message: '如果该邮箱已注册，你将收到验证码', retryAfterSeconds: 60 })
  expect(mail.messages).toHaveLength(1)
  expect(mail.messages[0].to).toBe(user.email)
  const receivedCode = code(mail.messages[0].text)
  expect(receivedCode).toMatch(/^\d{6}$/)
  const challenge = await row(user.email)
  expect(challenge.userId).toBe(user.id)
  expect(challenge.deliveryStatus).toBe('SENT')
  expect(challenge.failedAttempts).toBe(0)
  expect(challenge.consumedAt).toBeNull()
  expect(challenge.expiresAt.getTime() - challenge.sentAt.getTime()).toBe(600_000)
  expect(challenge.sentAt.getTime()).toBeGreaterThanOrEqual(before)
  expect(challenge.codeHash).toBe(createHmac('sha256', secret).update(
    ['password-reset', emailKey(user.email), challenge.challengeId, receivedCode].join('\0')).digest('hex'))
  expect(challenge.codeHash).not.toBe(receivedCode)
  expect(Object.keys(result).sort()).toEqual(['message', 'retryAfterSeconds'])
})

test('existing, unknown and soft-deleted addresses share the same response and resend policy', async () => {
  const active = await makeUser(email())
  const deleted = await makeUser(email())
  await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
  const unknown = email()
  const mail = createCaptureMailTransport()
  const results = []
  for (const address of [active.email, unknown, deleted.email]) {
    results.push(await requestPasswordReset(await input(address), { mail }))
    await expect(requestPasswordReset(await input(address), { mail })).rejects.toMatchObject({ reason: 'limited', retryAfterSeconds: 60 })
  }
  expect(results[1]).toEqual(results[0]); expect(results[2]).toEqual(results[0])
  expect(mail.messages.map(message => message.to)).toEqual([active.email])
  for (const address of [unknown, deleted.email]) {
    expect(await row(address)).toMatchObject({ userId: null, codeHash: null, deliveryStatus: 'FAILED' })
  }
})

test('image captcha is purpose-bound and one-use, including when later issuance fails', async () => {
  const address = email()
  const mail = createCaptureMailTransport()
  const wrongPurpose = await input(address, ip(), 'login')
  await expect(requestPasswordReset(wrongPurpose, { mail })).rejects.toMatchObject({ reason: 'captcha' })
  expect(await db.passwordResetChallenge.count({ where: { emailKey: emailKey(address) } })).toBe(0)
  const valid = await input(address)
  await requestPasswordReset(valid, { mail })
  await expect(requestPasswordReset(valid, { mail })).rejects.toMatchObject({ reason: 'captcha' })
  const cooled = await input(address)
  await expect(requestPasswordReset(cooled, { mail })).rejects.toMatchObject({ reason: 'limited' })
  await expect(requestPasswordReset(cooled, { mail })).rejects.toMatchObject({ reason: 'captcha' })
})

test('concurrent requests for one email reserve one challenge and send exactly one message', async () => {
  const user = await makeUser(email())
  const mail = createCaptureMailTransport()
  const source = ip()
  const inputs = await Promise.all(Array.from({ length: 4 }, () => input(user.email, source)))
  const results = await Promise.allSettled(inputs.map(value => requestPasswordReset(value, { mail })))
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason.reason)).toEqual(['limited', 'limited', 'limited'])
  expect(mail.messages).toHaveLength(1)
  expect(await db.passwordResetChallenge.count({ where: { emailKey: emailKey(user.email) } })).toBe(1)
})

test('resend opens after sixty seconds and replaces the old digest without clearing send quota', async () => {
  const user = await makeUser(email())
  const mail = createCaptureMailTransport()
  await requestPasswordReset(await input(user.email), { mail })
  const old = await row(user.email)
  await db.passwordResetChallenge.update({ where: { emailKey: old.emailKey }, data: { sentAt: new Date(Date.now() - 59_500) } })
  await expect(requestPasswordReset(await input(user.email), { mail })).rejects.toMatchObject({ reason: 'limited', retryAfterSeconds: 1 })
  await allowResend(user.email)
  await requestPasswordReset(await input(user.email), { mail })
  const latest = await row(user.email)
  expect(latest.challengeId).not.toBe(old.challengeId)
  expect(latest.codeHash).not.toBe(old.codeHash)
  expect(latest.deliveryStatus).toBe('SENT')
  expect((await db.authRateBucket.findUniqueOrThrow({ where: { key: `reset:send:email:${old.emailKey}` } })).count).toBe(3)
})

test('the sixth request for one email is limited even when IP changes and cooldown has passed', async () => {
  const user = await makeUser(email())
  const mail = createCaptureMailTransport()
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await allowResend(user.email)
    await requestPasswordReset(await input(user.email), { mail })
  }
  await allowResend(user.email)
  await expect(requestPasswordReset(await input(user.email), { mail })).rejects.toMatchObject({ reason: 'limited' })
  expect(mail.messages).toHaveLength(5)
})

test('one IP permits twenty requests across emails and concurrent contenders cannot share its last slot', async () => {
  const source = ip()
  const mail = createCaptureMailTransport()
  for (let attempt = 0; attempt < 19; attempt++) await requestPasswordReset(await input(email(), source), { mail })
  const inputs = await Promise.all([input(email(), source), input(email(), source)])
  const results = await Promise.allSettled(inputs.map(value => requestPasswordReset(value, { mail })))
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  const bucket = await db.authRateBucket.findUniqueOrThrow({ where: { key: `reset:send:ip:${authDigest('password-reset-ip', source)}` } })
  expect(bucket.count).toBe(20)
  expect(mail.messages).toEqual([])
})

for (const failure of ['MAIL_RECIPIENT_REJECTED', 'MAIL_UNAVAILABLE'] as const) {
  test(`${failure} after preflight clears the new code, invalidates the old code and preserves a uniform response`, async () => {
    const user = await makeUser(email())
    const mail = createCaptureMailTransport()
    await requestPasswordReset(await input(user.email), { mail })
    const old = await row(user.email)
    await allowResend(user.email)
    const failed: MailTransport = { verify: async () => {}, send: async () => { throw new MailError(failure) } }
    const result = await requestPasswordReset(await input(user.email), { mail: failed })
    const unknown = await requestPasswordReset(await input(email()), { mail: failed })
    expect(result).toEqual(unknown)
    const latest = await row(user.email)
    expect(latest.challengeId).not.toBe(old.challengeId)
    expect(latest).toMatchObject({ codeHash: null, deliveryStatus: 'FAILED' })
    await expect(requestPasswordReset(await input(user.email), { mail })).rejects.toMatchObject({ reason: 'limited' })
  })
}

test('a global mail availability failure returns the same system error before creating any challenge', async () => {
  const user = await makeUser(email())
  const mail: MailTransport = { verify: async () => { throw new MailError('MAIL_UNAVAILABLE') }, send: async () => { throw new Error('must not send') } }
  for (const address of [user.email, email()]) {
    await expect(requestPasswordReset(await input(address), { mail })).rejects.toMatchObject({ reason: 'unavailable', message: '密码找回服务暂时不可用' })
    expect(await db.passwordResetChallenge.count({ where: { emailKey: emailKey(address) } })).toBe(0)
  }
})

for (const finish of ['success', 'failure']) {
  test(`a delayed older SMTP ${finish} cannot overwrite a newer challenge and holds no database transaction`, async () => {
    const user = await makeUser(email())
    let release!: () => void
    let notify!: () => void
    const started = new Promise<void>(resolve => { notify = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const slow: MailTransport = { verify: async () => {}, send: async () => {
      notify(); await gate
      if (finish === 'failure') throw new MailError('MAIL_UNAVAILABLE')
    } }
    const first = requestPasswordReset(await input(user.email), { mail: slow })
    let latest
    try {
      await started
      expect((await row(user.email)).deliveryStatus).toBe('PENDING')
      // This write and the next request finish while SMTP is still blocked.
      await allowResend(user.email)
      await requestPasswordReset(await input(user.email), { mail: createCaptureMailTransport() })
      latest = await row(user.email)
    } finally { release(); await first }
    expect(await row(user.email)).toEqual(latest)
  })
}

test('HTTP rejects invalid captcha and returns the same unavailable response for existing and unknown mailboxes without SMTP configuration', async ({ request }) => {
  const user = await makeUser(email())
  const source = ip()
  expect((await request.post('/api/auth/password-reset/request', { data: { email: user.email } })).status()).toBe(400)
  expect((await request.post('/api/auth/password-reset/request', { data: '{' })).status()).toBe(400)
  const results = []
  for (const address of [user.email, email()]) {
    const captcha = await getCaptcha(request, 'password-reset')
    captchaIds.push(captcha.id)
    const response = await request.post('/api/auth/password-reset/request', {
      headers: { 'x-forwarded-for': source }, data: { email: address, captchaId: captcha.id, captchaCode: captcha.code },
    })
    expect(response.status()).toBe(503)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    const { timestamp, ...body } = await response.json()
    results.push(body)
  }
  expect(results[0]).toEqual(results[1])
})

test('HTTP rate limiting derives IP from request context and ignores a forged body IP', async ({ request }) => {
  const source = ip()
  await db.authRateBucket.create({ data: { key: `reset:send:ip:${authDigest('password-reset-ip', source)}`, count: 20, windowStart: new Date() } })
  const address = email()
  const captcha = await getCaptcha(request, 'password-reset')
  captchaIds.push(captcha.id)
  const response = await request.post('/api/auth/password-reset/request', {
    headers: { 'x-forwarded-for': source }, data: { email: address, captchaId: captcha.id, captchaCode: captcha.code, ip: ip() },
  })
  expect(response.status()).toBe(429)
  expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0)
  expect((await response.json()).data.retryAfterSeconds).toBeGreaterThan(0)
  expect(await db.passwordResetChallenge.count({ where: { emailKey: emailKey(address) } })).toBe(0)
})

test('the actual request route verifies SMTP, delivers over TLS and returns no code or account identifier', async () => {
  const server = await startCaptureSmtp('tls')
  try {
    const user = await makeUser(email())
    const data = await input(user.email)
    const { stdout, stderr } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '-e', `
      const {POST}=require('./src/app/api/auth/password-reset/request/route.ts');
      const {prisma}=require('./src/server/db');
      (async()=>{try {
        const input=JSON.parse(process.argv[1]);
        const response=await POST(new Request('http://localhost/api/auth/password-reset/request', {
          method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':input.ip},body:JSON.stringify(input)
        }));
        console.log(JSON.stringify({status:response.status,cache:response.headers.get('cache-control'),body:await response.json()}));
      } finally {await prisma.$disconnect()}})();
    `, JSON.stringify(data)], { timeout: 20_000, env: {
      ...process.env, NODE_ENV: 'test', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.port), SMTP_SECURE: 'true',
      SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com',
      NODE_EXTRA_CA_CERTS: resolve('tests/fixtures/smtp/localhost-cert.pem'),
    } })
    const response = JSON.parse(stdout)
    expect(response).toMatchObject({ status: 200, cache: 'private, no-store', body: {
      code: 2000, message: '如果该邮箱已注册，你将收到验证码', data: { retryAfterSeconds: 60 },
    } })
    expect(Object.keys(response.body.data)).toEqual(['retryAfterSeconds'])
    expect(server.messages).toHaveLength(1)
    expect(server.messages[0]).toContain(`To: ${user.email}`)
    expect(server.commands.filter(command => command === 'AUTH')).toHaveLength(2)
    expect((await row(user.email)).deliveryStatus).toBe('SENT')
    expect(stdout + stderr).not.toContain(user.email)
    expect(stdout + stderr).not.toContain('test-password')
  } finally { await server.close() }
})
