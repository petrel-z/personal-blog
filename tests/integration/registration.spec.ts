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

test('admin creation keeps the admin session and only refreshes captcha when opening another form', async ({ page }) => {
  const admin = await makeUser(newEmail())
  const email = newEmail()
  const permission = await db.permission.upsert({ where: { code: 'user:read' }, create: { code: 'user:read' }, update: {} })
  const role = await db.role.create({ data: {
    name: `registration-${randomUUID()}`,
    rolePermissions: { create: { permissionId: permission.id } },
    userRoles: { create: { userId: admin.id } },
  } })
  try {
    const request = page.context().request
    const captcha = await getCaptcha(request, 'login')
    expect((await login(request, { email: admin.email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })).searchParams.has('error')).toBe(false)
    let issued = 0
    page.on('request', request => { if (request.url().includes('/api/captcha?purpose=register')) issued++ })
    await page.goto('/admin/users')
    await page.getByRole('button', { name: '添加用户' }).click()
    await fillRegistration(page, email)
    const before = issued
    await page.getByRole('button', { name: '注册', exact: true }).click()
    await expect(page.getByRole('button', { name: '添加用户' })).toBeVisible()
    expect((await (await request.get('/api/auth/session')).json()).user.id).toBe(admin.id)
    expect(await db.user.findUnique({ where: { email } })).not.toBeNull()
    expect(issued).toBe(before)
    await page.getByRole('button', { name: '添加用户' }).click()
    await page.getByRole('img', { name: '验证码' }).waitFor()
    expect(issued).toBe(before + 1)
    await expect(page.getByPlaceholder('验证码', { exact: true })).toHaveValue('')
  } finally {
    await db.role.delete({ where: { id: role.id } })
  }
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
