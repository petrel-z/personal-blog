import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import bcrypt from 'bcryptjs'
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

const emails: string[] = []
const clients: APIRequestContext[] = []
let roles: Record<string, string>
function email() {
  const value = `managed-${randomUUID()}@example.com`
  emails.push(value)
  return value
}
async function user(name: string) {
  const created = await makeUser(email())
  await db.userRole.create({ data: { userId: created.id, roleId: roles[name] } })
  return created
}
async function authenticate(client: APIRequestContext, email: string) {
  const captcha = await getCaptcha(client, 'login')
  expect((await login(client, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })).searchParams.has('error')).toBe(false)
}
async function clientFor(email: string) {
  const client = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:3017' })
  clients.push(client)
  await authenticate(client, email)
  return client
}
function executeTestDDL(sql: string) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--stdin'], {
    input: sql, encoding: 'utf8', env: process.env, timeout: 15_000,
  })
  if (result.status !== 0) throw new Error(`Isolated test DDL failed: ${result.stderr}`)
}
test.beforeEach(async () => {
  roles = {}
  for (const name of ['admin', 'editor', 'reviewer', 'member']) {
    roles[name] = (await db.role.upsert({ where: { name }, create: { name }, update: {} })).id
  }
})
test.afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.dispose()))
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  await db.auditLog.deleteMany({ where: { userId: { in: users.map(user => user.id) } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: emails.map(emailKey) } } })
  emails.length = 0
})
test.afterAll(async () => { await db.$disconnect() })

test('only current administrators can create users and invalid input creates nothing', async ({ request }) => {
  expect((await request.post('/api/auth/users', { data: '{' })).status()).toBe(401)
  const ordinary = await clientFor((await user('member')).email)
  const target = email()
  const data = { name: 'Managed test', email: target, password: testPassword, roleIds: [roles.admin] }
  expect((await ordinary.post('/api/auth/users', { data })).status()).toBe(403)
  const operator = await user('admin')
  await authenticate(request, operator.email)
  for (const change of [{ name: ' ' }, { password: 'short' }, { password: '中'.repeat(25) },
    { roleIds: [] }, { roleIds: [roles.member, roles.member] }, { roleIds: ['unknown'] }]) {
    expect((await request.post('/api/auth/users', { data: { ...data, ...change } })).status()).toBe(400)
  }
  expect(await db.user.findUnique({ where: { email: target } })).toBeNull()
  expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
})

test('creation persists selected roles and a usable password without replacing the administrator session', async ({ request }) => {
  const operator = await user('admin')
  await authenticate(request, operator.email)
  const target = email()
  const response = await request.post('/api/auth/users', { data: {
    name: ' Managed test ', email: ` ${target.toUpperCase()} `, password: testPassword, roleIds: [roles.reviewer, roles.editor],
  } })
  expect(response.status()).toBe(201)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  const body = await response.json()
  const created = await db.user.findUniqueOrThrow({ where: { email: target }, include: { userRoles: { include: { role: true } } } })
  expect(body.data).toEqual({ id: created.id, email: target })
  expect(created.name).toBe('Managed test')
  expect(created.userRoles.map(link => link.role.name).sort()).toEqual(['editor', 'reviewer'])
  expect(await bcrypt.compare(testPassword, created.password)).toBe(true)
  const audit = await db.auditLog.findMany({ where: { userId: operator.id, action: 'USER_CREATE' } })
  expect(audit).toHaveLength(1)
  expect(audit[0].target).toBe(created.id)
  expect(JSON.parse(audit[0].details!)).toEqual({ email: target, roles: [
    { id: roles.editor, name: 'editor' }, { id: roles.reviewer, name: 'reviewer' },
  ] })
  expect(JSON.stringify([body, audit])).not.toContain(testPassword)
  expect(JSON.stringify([body, audit])).not.toContain(created.password)
  expect((await (await request.get('/api/auth/session')).json()).user.id).toBe(operator.id)
  const newClient = await clientFor(target)
  expect((await (await newClient.get('/api/auth/session')).json()).user.id).toBe(created.id)
})

test('concurrent requests for one email create exactly one account with roles and one audit', async () => {
  const a = await clientFor((await user('admin')).email)
  const b = await clientFor((await user('admin')).email)
  const target = email()
  const data = { name: 'Concurrent user', email: target, password: testPassword, roleIds: [roles.member] }
  const responses = await Promise.all([a.post('/api/auth/users', { data }), b.post('/api/auth/users', { data: { ...data, email: target.toUpperCase() } })])
  expect(responses.map(response => response.status()).sort()).toEqual([201, 409])
  const created = await db.user.findMany({ where: { email: target }, include: { userRoles: true } })
  expect(created).toHaveLength(1)
  expect(created[0].userRoles.map(role => role.roleId)).toEqual([roles.member])
  expect(await db.auditLog.count({ where: { target: created[0].id, action: 'USER_CREATE' } })).toBe(1)
})

test('soft-deleted accounts still reserve their email', async ({ request }) => {
  const operator = await user('admin')
  const deleted = await user('member')
  await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
  await authenticate(request, operator.email)
  expect((await request.post('/api/auth/users', { data: {
    name: 'Duplicate', email: deleted.email, password: testPassword, roleIds: [roles.admin],
  } })).status()).toBe(409)
  expect((await db.user.findUniqueOrThrow({ where: { id: deleted.id } })).deletedAt).not.toBeNull()
  expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
})

for (const failure of ['membership', 'audit']) {
  test(`${failure} insertion failure rolls back the account, memberships and audit`, async ({ request }) => {
    const operator = await user('admin')
    await authenticate(request, operator.email)
    const target = email()
    const trigger = `managed_${failure}_${randomUUID().replaceAll('-', '')}`
    const sql = failure === 'audit'
      ? `CREATE TRIGGER ${trigger} BEFORE INSERT ON AuditLog FOR EACH ROW BEGIN
          IF NEW.action = 'USER_CREATE' AND NEW.userId = '${operator.id}' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test creation audit failure';
          END IF; END`
      : `CREATE TRIGGER ${trigger} BEFORE INSERT ON UserRole FOR EACH ROW BEGIN
          IF EXISTS (SELECT 1 FROM User WHERE id = NEW.userId AND email = '${target}') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test creation membership failure';
          END IF; END`
    executeTestDDL(sql)
    try {
      const response = await request.post('/api/auth/users', { data: {
        name: 'Rollback user', email: target, password: testPassword, roleIds: [roles.editor, roles.member],
      } })
      expect(response.status()).toBe(500)
      expect(await response.text()).not.toContain('Test creation')
      expect(await db.user.findUnique({ where: { email: target } })).toBeNull()
      expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
    } finally { executeTestDDL(`DROP TRIGGER ${trigger}`) }
  })
}

test('role loading failures can retry and submission failures keep the form and selected roles', async ({ page }) => {
  const operator = await user('admin')
  await authenticate(page.context().request, operator.email)
  await page.goto('/admin/users')
  await page.route('**/api/auth/roles', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ code: 5000, message: '获取角色列表失败', data: null }),
  }))
  await page.getByRole('button', { name: '添加用户', exact: true }).click()
  const form = page.getByRole('form', { name: '创建用户' })
  await expect(form.getByRole('alert')).toContainText('获取角色列表失败')
  await expect(form.getByRole('button', { name: '创建用户', exact: true })).toBeDisabled()
  await page.unroute('**/api/auth/roles')
  await form.getByRole('button', { name: '重试', exact: true }).click()
  await expect(form.getByRole('checkbox', { name: '普通会员', exact: true })).toBeChecked()
  await form.getByLabel('用户名', { exact: true }).fill('Duplicate test')
  await form.getByLabel('邮箱', { exact: true }).fill(operator.email)
  await form.getByLabel('密码', { exact: true }).fill(testPassword)
  await form.getByLabel('确认密码', { exact: true }).fill(testPassword)
  await form.getByRole('checkbox', { name: '编辑者', exact: true }).check()
  await form.getByRole('button', { name: '创建用户', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('该邮箱已被注册')
  await expect(form.getByLabel('用户名', { exact: true })).toHaveValue('Duplicate test')
  await expect(form.getByLabel('密码', { exact: true })).toHaveValue(testPassword)
  await expect(form.getByRole('checkbox', { name: '编辑者', exact: true })).toBeChecked()
  const target = email()
  await form.getByLabel('邮箱', { exact: true }).fill(target)
  await form.getByLabel('密码', { exact: true }).fill('中'.repeat(25))
  await form.getByLabel('确认密码', { exact: true }).fill('中'.repeat(25))
  await form.getByRole('button', { name: '创建用户', exact: true }).click()
  await expect(form.getByText(/密码不能超过72字节/)).toBeVisible()
  expect(await db.user.findUnique({ where: { email: target } })).toBeNull()
  await form.getByLabel('密码', { exact: true }).fill(testPassword)
  await form.getByLabel('确认密码', { exact: true }).fill(testPassword)
  await form.getByRole('checkbox', { name: '编辑者', exact: true }).uncheck()
  await form.getByRole('checkbox', { name: '普通会员', exact: true }).uncheck()
  await form.getByRole('button', { name: '创建用户', exact: true }).click()
  await expect(form.getByText('请至少选择一个角色', { exact: true })).toBeVisible()
  await form.getByRole('checkbox', { name: '普通会员', exact: true }).check()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/users', async route => {
    if (route.request().method() === 'POST') await gate
    await route.continue()
  })
  try {
    await form.getByRole('button', { name: '创建用户', exact: true }).click()
    await expect(form.getByRole('button', { name: '创建中...', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '取消添加', exact: true })).toBeDisabled()
    await expect(form.getByRole('checkbox', { name: '普通会员', exact: true })).toBeDisabled()
  } finally { release() }
  await expect(page.getByRole('status')).toContainText('用户创建成功')
})
