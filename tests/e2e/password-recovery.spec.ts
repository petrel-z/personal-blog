import { randomUUID, randomInt } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { db, makeUser } from '../integration/auth-fixtures'
import { setupAuthorization } from '../../scripts/setup-auth'
import { authDigest, emailKey } from '../../src/server/features/auth/identity'
import { startRecoveryApp, capturedResetCode } from '../helpers/recovery-app'
import { createTencentVerifier } from '../helpers/tencent-captcha'
import { requestPasswordReset } from '../../src/server/features/auth/password-reset.service'
import { PasswordResetError } from '../../src/server/features/auth/password-reset-error'
import { createMailTransport } from '../../src/server/mail/transport'
import { prisma } from '../../src/server/db'

let app: Awaited<ReturnType<typeof startRecoveryApp>>
let email: string, ip: string
let captchaIds: string[] = []
const password = 'Recovered-password-29!'

test.beforeAll(async () => { test.setTimeout(120_000); app = await startRecoveryApp() })
test.afterAll(async () => { await app?.close(); await Promise.all([db.$disconnect(), prisma.$disconnect()]) })
test.beforeEach(async ({ context, page }) => {
  captchaIds = []
  context.on('response', response => {
    const id = response.headers()['x-captcha-id']
    if (response.url().includes('/api/captcha') && id) captchaIds.push(id)
  })
  email = `recovery-${randomUUID()}@example.com`
  ip = `198.18.${randomInt(256)}.${randomInt(1, 255)}`
  await makeUser(email)
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const verifier = createTencentVerifier()
  await page.route('https://turing.captcha.qcloud.com/TJCaptcha.js', route => {
    const proofs = Array.from({ length: 10 }, () => verifier.issue())
    return route.fulfill({ contentType: 'application/javascript', body: `window.TencentCaptcha = class {
      constructor(id, callback) { this.callback = callback }
      show() { this.callback({ret: 0, ...(${JSON.stringify(proofs)})[window.ticketIndex = (window.ticketIndex || 0) + 1]}) }
      destroy() {}
    }` })
  })
  // Stub the cloud boundary; retain real database, rate limits and loopback TLS SMTP.
  // The production HTTP route and SDK contract are covered by Jest tests.
  await page.route('**/api/auth/password-reset/request', async route => {
    const mail = createMailTransport({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(app.smtp.port), SMTP_SECURE: 'true',
      SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com' })
    try {
      const result = await requestPasswordReset({ ...route.request().postDataJSON(),
        ip: route.request().headers()['x-forwarded-for'] ?? 'unknown' }, { mail, verifyCaptcha: verifier.verify })
      await route.fulfill({ json: { code: 2000, message: result.message, data: { retryAfterSeconds: result.retryAfterSeconds } } })
    } catch (error) {
      if (!(error instanceof PasswordResetError)) throw error
      const status = error.reason === 'limited' ? 429 : error.reason === 'unavailable' ? 503 : 400
      await route.fulfill({ status, json: { code: status * 10, message: error.message,
        data: status === 429 ? { retryAfterSeconds: error.retryAfterSeconds } : null } })
    }
  })
})
test.afterEach(async () => {
  const key = emailKey(email)
  await db.passwordResetChallenge.deleteMany({ where: { emailKey: key } })
  await db.authRateBucket.deleteMany({ where: { key: { in: [
    `reset:send:email:${key}`, `reset:verify:email:${key}`,
    `reset:send:ip:${authDigest('password-reset-ip', ip)}`, `reset:verify:ip:${authDigest('password-reset-ip', ip)}`,
  ] } } })
  await db.loginAttempt.deleteMany({ where: { key } })
  await db.captchaChallenge.deleteMany({ where: { id: { in: captchaIds } } })
  await db.user.deleteMany({ where: { email } })
})

async function fillCaptcha(page: Page) {
  const image = page.getByRole('img', { name: '验证码', exact: true })
  await expect(image).toBeVisible()
  const svg = await image.evaluate(async element => (await fetch((element as HTMLImageElement).src)).text())
  const code = Array.from(svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g), match => match[1]).join('')
  await page.getByPlaceholder('验证码', { exact: true }).fill(code)
}
async function sendCode(page: Page) {
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill(email)
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByLabel('邮件验证码', { exact: true })).toBeVisible()
  const message = app.smtp.messages.filter(message => message.includes(`To: ${email}`)).at(-1)!
  return capturedResetCode(message)
}
async function fillReset(page: Page, code: string) {
  await page.getByLabel('邮件验证码', { exact: true }).fill(code)
  await page.getByLabel('新密码', { exact: true }).fill(password)
  await page.getByLabel('确认新密码', { exact: true }).fill(password)
}
async function assertPrivateStorage(page: Page, code: string) {
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
  for (const secret of [email, password, code]) expect(storage).not.toContain(secret)
  expect(page.url()).not.toContain(email)
}

test('login links to recovery; a real SMTP code resets the password and permits login', async ({ page }) => {
  test.setTimeout(60_000)
  await setupAuthorization(db, email)
  await page.goto('/login')
  await page.getByRole('link', { name: '忘记密码？' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  const code = await sendCode(page)
  await fillReset(page, code)
  await assertPrivateStorage(page, code)
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('密码重置成功')
  await expect(page.getByLabel('新密码', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '返回登录', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await fillCaptcha(page)
  const accessReady = page.waitForResponse(response => response.url().includes('/api/auth/access?'))
  await page.getByRole('button', { name: '登录', exact: true }).click()
  expect(await (await accessReady).json()).toMatchObject({ data: { destination: '/admin/dashboard' } })
  // The dedicated development server compiles the protected dashboard on first entry.
  await expect(page).toHaveURL('http://127.0.0.1:3018/admin/dashboard', { timeout: 20_000 })
  expect((await (await page.request.get('/api/auth/session')).json()).user.email).toBe(email)
  expect((await db.user.findUniqueOrThrow({ where: { email } })).sessionVersion).toBe(1)
})

test('wrong and expired codes show actionable errors without changing the password', async ({ page }) => {
  const code = await sendCode(page)
  await fillReset(page, code === '000000' ? '000001' : '000000')
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('邮件验证码错误或已失效')
  await db.passwordResetChallenge.update({ where: { emailKey: emailKey(email) }, data: { expiresAt: new Date(0) } })
  await page.getByLabel('邮件验证码', { exact: true }).fill(code)
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('邮件验证码错误或已失效')
  expect((await db.user.findUniqueOrThrow({ where: { email } })).sessionVersion).toBe(0)
})

test('password mismatch and oversized UTF-8 password are rejected before confirmation', async ({ page }) => {
  const code = await sendCode(page)
  let submissions = 0
  page.on('request', request => { if (request.url().endsWith('/password-reset/confirm')) submissions++ })
  await fillReset(page, code)
  await page.getByLabel('确认新密码', { exact: true }).fill('Another-password!')
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('两次密码不一致')
  await page.getByLabel('新密码', { exact: true }).fill('密'.repeat(25))
  await page.getByLabel('确认新密码', { exact: true }).fill('密'.repeat(25))
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('72字节')
  expect(submissions).toBe(0)
})

test('refresh retains the cooldown without persisting email, code or password; an existing code still works', async ({ page }) => {
  const code = await sendCode(page)
  await fillReset(page, code)
  await assertPrivateStorage(page, code)
  await page.reload()
  await expect(page.getByLabel('注册邮箱', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
  await page.getByLabel('注册邮箱', { exact: true }).fill(email)
  await page.getByRole('button', { name: '已有邮件验证码', exact: true }).click()
  await fillReset(page, code)
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('密码重置成功')
})

test('resending requires a fresh Tencent ticket and honors the server cooldown', async ({ page }) => {
  await page.clock.install()
  await sendCode(page)
  await expect(page.getByRole('button', { name: /秒后可重发/ })).toBeDisabled()
  await db.passwordResetChallenge.update({ where: { emailKey: emailKey(email) }, data: { sentAt: new Date(Date.now() - 61_000) } })
  await page.clock.fastForward(61_000)
  await page.getByRole('button', { name: '重新发送', exact: true }).click()
  await page.getByRole('button', { name: '发送新验证码', exact: true }).click()
  await expect(page.getByRole('button', { name: /秒后可重发/ })).toBeDisabled()
  const messages = app.smtp.messages.filter(message => message.includes(`To: ${email}`))
  expect(messages).toHaveLength(2)
  await fillReset(page, capturedResetCode(messages[1]))
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('密码重置成功')
})

test('network failures obtain new Tencent tickets and allow send and confirmation retries', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill(email)
  await page.route('**/api/auth/password-reset/request', route => route.abort(), { times: 1 })
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('网络')
  await expect(page.getByLabel('注册邮箱', { exact: true })).toHaveValue(email)
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByLabel('邮件验证码', { exact: true })).toBeVisible()
  const code = capturedResetCode(app.smtp.messages.filter(message => message.includes(`To: ${email}`)).at(-1)!)
  await fillReset(page, code)
  await page.route('**/api/auth/password-reset/confirm', route => route.abort(), { times: 1 })
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('网络')
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('密码重置成功')
})

test('a slow submission cannot send duplicate mail', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let count = 0
  await page.route('**/api/auth/password-reset/request', async route => { count++; await gate; await route.fallback() })
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill(email)
  const button = page.getByRole('button', { name: '发送邮件验证码', exact: true })
  await button.evaluate(button => { const form = (button as HTMLButtonElement).form!; form.requestSubmit(); form.requestSubmit() })
  await expect(page.getByRole('button', { name: '发送中…', exact: true })).toBeDisabled()
  release()
  await expect(page.getByLabel('邮件验证码', { exact: true })).toBeVisible()
  expect(count).toBe(1)
  expect(app.smtp.messages.filter(message => message.includes(`To: ${email}`))).toHaveLength(1)
})

test('unavailable mail stays on the first step; server limits show a persistent retry countdown', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill(email)
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ status: 503, json: { code: 5030, message: '密码找回服务暂时不可用', data: null } }), { times: 1 })
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('暂时不可用')
  await expect(page.getByLabel('邮件验证码', { exact: true })).toHaveCount(0)
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ status: 429, headers: { 'Retry-After': '120' }, json: { code: 4290, message: '申请过于频繁，请稍后重试', data: { retryAfterSeconds: 120 } } }), { times: 1 })
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
})

test('blocked browser storage does not prevent password recovery and mobile fields remain visible', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled') }; Storage.prototype.getItem = () => { throw new Error('Storage disabled') } })
  await page.setViewportSize({ width: 375, height: 812 })
  const code = await sendCode(page)
  await fillReset(page, code)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/blog-f12-mobile.png', fullPage: true })
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('密码重置成功')
})
