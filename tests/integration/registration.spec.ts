import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

const emails: string[] = []
function newEmail() {
  const email = `registration-${randomUUID()}@example.com`
  emails.push(email)
  return email
}

test.afterEach(async () => {
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  await db.auditLog.deleteMany({ where: { userId: { in: users.map(user => user.id) } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: emails.map(emailKey) } } })
  emails.length = 0
})
test.afterAll(async () => { await db.$disconnect() })

async function fillRegistration(page: Page, email: string) {
  const image = page.getByRole('img', { name: '验证码' })
  await image.waitFor()
  const code = await image.evaluate(async element => {
    const svg = await (await fetch((element as HTMLImageElement).src)).text()
    return Array.from(svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g), match => match[1]).join('')
  })
  await page.getByLabel('用户名', { exact: true }).fill('Registration test')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(testPassword)
  await page.getByLabel('确认密码', { exact: true }).fill(testPassword)
  await page.getByPlaceholder('验证码', { exact: true }).fill(code)
}

async function registerAndSignIn(request: APIRequestContext, credentials: Record<string, string>) {
  const { csrfToken } = await (await request.get('/api/auth/csrf')).json()
  const response = await request.post('/api/auth/callback/registration', {
    headers: { 'X-Auth-Return-Redirect': '1' },
    form: { csrfToken, name: 'Registration test', password: testPassword, ...credentials },
  })
  return new URL((await response.json()).url)
}

test('public registration signs in a member and goes home without fetching another captcha', async ({ page }) => {
  const email = newEmail()
  let issued = 0
  page.on('request', request => { if (request.url().includes('/api/captcha?purpose=register')) issued++ })
  await page.goto('/register')
  await fillRegistration(page, email)
  const before = issued
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL('/')
  const session = await (await page.context().request.get('/api/auth/session')).json()
  expect(session?.user.email).toBe(email)
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { userRoles: { include: { role: true } } } })
  expect(session.user.id).toBe(user.id)
  expect(user.userRoles.map(link => link.role.name)).toEqual(['member'])
  expect(issued).toBe(before)
})

test('admin creates selected-role users without captcha or changing the signed-in identity', async ({ page }) => {
  const admin = await makeUser(newEmail())
  const email = newEmail()
  const roles: Record<string, string> = {}
  for (const name of ['admin', 'editor', 'reviewer', 'member']) {
    roles[name] = (await db.role.upsert({ where: { name }, create: { name }, update: {} })).id
  }
  await db.userRole.create({ data: { userId: admin.id, roleId: roles.admin } })
  const request = page.context().request
  const captcha = await getCaptcha(request, 'login')
  expect((await login(request, { email: admin.email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })).searchParams.has('error')).toBe(false)
  let issued = 0
  let publicRegistrations = 0
  page.on('request', request => {
    if (request.url().includes('/api/captcha?purpose=register')) issued++
    if (request.url().includes('/api/auth/register') || request.url().includes('/api/auth/callback/registration')) publicRegistrations++
  })
  await page.goto('/admin/users')
  await page.getByRole('button', { name: '添加用户', exact: true }).click()
  const form = page.getByRole('form', { name: '创建用户' })
  await expect(form.getByRole('checkbox', { name: '普通会员', exact: true })).toBeChecked()
  await expect(form.getByRole('img', { name: '验证码' })).toHaveCount(0)
  await form.getByLabel('用户名', { exact: true }).fill('Managed user')
  await form.getByLabel('邮箱', { exact: true }).fill(email)
  await form.getByLabel('密码', { exact: true }).fill(testPassword)
  await form.getByLabel('确认密码', { exact: true }).fill(testPassword)
  await form.getByRole('checkbox', { name: '普通会员', exact: true }).uncheck()
  await form.getByRole('checkbox', { name: '编辑者', exact: true }).check()
  await form.getByRole('checkbox', { name: '审核者', exact: true }).check()
  await page.screenshot({ path: test.info().outputPath('create-managed-user.png'), fullPage: true })
  await form.getByRole('button', { name: '创建用户', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('用户创建成功')
  await expect(form).toHaveCount(0)
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: email, exact: true }) })
  await expect(row.getByText('编辑者', { exact: true })).toBeVisible()
  await expect(row.getByText('审核者', { exact: true })).toBeVisible()
  expect((await (await request.get('/api/auth/session')).json()).user.id).toBe(admin.id)
  await page.getByRole('button', { name: '添加用户', exact: true }).click()
  await expect(form.getByRole('checkbox', { name: '普通会员', exact: true })).toBeChecked()
  await expect(form.getByLabel('密码', { exact: true })).toHaveValue('')
  expect(issued).toBe(0)
  expect(publicRegistrations).toBe(0)
})

test('duplicate public registration refreshes captcha and never signs in as the existing account', async ({ page }) => {
  const user = await makeUser(newEmail())
  await page.goto('/register')
  await fillRegistration(page, user.email)
  const image = page.getByRole('img', { name: '验证码' })
  const before = await image.getAttribute('src')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page.getByText('该邮箱已被注册', { exact: true })).toBeVisible()
  await expect(image).not.toHaveAttribute('src', before!)
  await expect(page.getByPlaceholder('验证码', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(user.email)
  expect(await (await page.context().request.get('/api/auth/session')).json()).toBeNull()
})

test('automatic sign-in requires a fresh registration captcha, never a login captcha', async ({ request }) => {
  const email = newEmail()
  const missing = await registerAndSignIn(request, { email })
  expect(missing.searchParams.get('code')).toBe('registration_invalid')
  const wrongPurpose = await getCaptcha(request, 'login')
  const invalid = await registerAndSignIn(request, { email, captchaId: wrongPurpose.id, captchaCode: wrongPurpose.code })
  expect(invalid.searchParams.get('code')).toBe('registration_captcha')
  expect(await db.user.findUnique({ where: { email } })).toBeNull()
  expect(await (await request.get('/api/auth/session')).json()).toBeNull()

  const captcha = await getCaptcha(request, 'register')
  const credentials = { email, captchaId: captcha.id, captchaCode: captcha.code }
  expect((await registerAndSignIn(request, credentials)).searchParams.has('error')).toBe(false)
  const otherEmail = newEmail()
  const replay = await registerAndSignIn(request, { ...credentials, email: otherEmail })
  expect(replay.searchParams.get('code')).toBe('registration_captcha')
  expect(await db.user.findUnique({ where: { email: otherEmail } })).toBeNull()
  expect((await (await request.get('/api/auth/session')).json()).user.email).toBe(email)
})

for (const entry of ['api', 'provider']) {
  test(`public ${entry} registration ignores forged administrator roles`, async ({ request }) => {
    const admin = await db.role.upsert({ where: { name: 'admin' }, create: { name: 'admin' }, update: {} })
    const email = newEmail()
    const captcha = await getCaptcha(request, 'register')
    const data = { name: 'Public user', email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code,
      roleIds: [admin.id], roles: ['admin'], isAdmin: true }
    if (entry === 'api') {
      expect((await request.post('/api/auth/register', { data })).status()).toBe(201)
    } else {
      const result = await registerAndSignIn(request, { ...data, roleIds: JSON.stringify(data.roleIds), roles: 'admin', isAdmin: 'true' })
      expect(result.searchParams.has('error')).toBe(false)
    }
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { userRoles: { include: { role: true } } } })
    expect(user.userRoles.map(link => link.role.name)).toEqual(['member'])
    expect((await request.get('/api/auth/users')).status()).toBe(entry === 'api' ? 401 : 403)
  })
  test(`public ${entry} registration rejects passwords exceeding 72 bytes`, async ({ request }) => {
    const email = newEmail()
    const captcha = await getCaptcha(request, 'register')
    const data = { name: 'Public user', email, password: '中'.repeat(25), captchaId: captcha.id, captchaCode: captcha.code }
    if (entry === 'api') {
      const response = await request.post('/api/auth/register', { data })
      expect(response.status()).toBe(400)
      expect((await response.json()).message).toContain('72字节')
    } else {
      expect((await registerAndSignIn(request, data)).searchParams.get('code')).toBe('registration_invalid')
    }
    expect(await db.user.findUnique({ where: { email } })).toBeNull()
    expect(await (await request.get('/api/auth/session')).json()).toBeNull()
  })
}
