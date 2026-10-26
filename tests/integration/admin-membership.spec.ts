import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

const users: { id: string; email: string }[] = []
const clients: APIRequestContext[] = []
let roles: Record<string, string>

async function user(names: string[] = []) {
  const created = await makeUser(`membership-${randomUUID()}@example.com`)
  users.push(created)
  if (names.length) await db.userRole.createMany({ data: names.map(name => ({ userId: created.id, roleId: roles[name] })) })
  return created
}
async function authenticate(client: APIRequestContext, email: string) {
  const captcha = await getCaptcha(client, 'login')
  const result = await login(client, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
  expect(result.searchParams.has('error')).toBe(false)
}
async function clientFor(email: string) {
  const client = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:3017' })
  clients.push(client)
  await authenticate(client, email)
  return client
}
const url = (id: string) => `/api/auth/users/${id}/roles`
const memberships = (id: string) => db.userRole.findMany({ where: { userId: id }, orderBy: { roleId: 'asc' } })

// MySQL does not support CREATE TRIGGER through Prisma's prepared query protocol.
function executeTestDDL(sql: string) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--stdin'], {
    input: sql, encoding: 'utf8', env: process.env, timeout: 15_000,
  })
  if (result.status !== 0) throw new Error(`Isolated test DDL failed: ${result.stderr}`)
}

test.beforeEach(async () => {
  roles = {}
  for (const name of ['admin', 'editor', 'reviewer', 'member']) {
    const role = await db.role.upsert({ where: { name }, create: { name }, update: {} })
    roles[name] = role.id
  }
  // Existing unrelated administrators would invalidate the last-admin scenarios; never remove them.
  expect(await db.userRole.count({ where: { roleId: roles.admin, user: { deletedAt: null } } })).toBe(0)
})
test.afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.dispose()))
  const ids = users.map(user => user.id)
  await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { target: { in: ids } }] } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: users.map(user => emailKey(user.email)) } } })
  users.length = 0
})
test.afterAll(async () => { await db.$disconnect() })

test('role assignment supports multiple roles, empty roles, immediate revocation and audit history', async ({ request }) => {
  const operator = await user(['admin'])
  const target = await user(['admin'])
  const targetClient = await clientFor(target.email)
  await authenticate(request, operator.email)
  expect((await targetClient.get('/api/auth/roles')).status()).toBe(200)

  const response = await request.patch(url(target.id), { data: { roleIds: [roles.editor, roles.reviewer] } })
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect((await memberships(target.id)).map(link => link.roleId).sort()).toEqual([roles.editor, roles.reviewer].sort())
  expect((await targetClient.get('/api/auth/roles')).status()).toBe(403)
  const audit = await db.auditLog.findMany({ where: { target: target.id, action: 'USER_ROLE_UPDATE' } })
  expect(audit).toHaveLength(1)
  expect(audit[0].userId).toBe(operator.id)
  expect(JSON.parse(audit[0].details!)).toEqual({
    before: [{ id: roles.admin, name: 'admin' }],
    after: [{ id: roles.editor, name: 'editor' }, { id: roles.reviewer, name: 'reviewer' }],
  })
  expect((await request.patch(url(target.id), { data: { roleIds: [roles.reviewer, roles.editor] } })).status()).toBe(200)
  expect(await db.auditLog.count({ where: { target: target.id } })).toBe(1)
  expect((await request.patch(url(target.id), { data: { roleIds: [] } })).status()).toBe(200)
  expect(await memberships(target.id)).toEqual([])
})

test('invalid inputs, deleted targets and non-admin requests cannot mutate roles', async ({ request }) => {
  const target = await user(['member'])
  expect((await request.patch(url(target.id), { data: '{', headers: { 'Content-Type': 'application/json' } })).status()).toBe(401)
  const memberClient = await clientFor(target.email)
  expect((await memberClient.patch(url(target.id), { data: { roleIds: [roles.admin] } })).status()).toBe(403)
  const operator = await user(['admin'])
  await authenticate(request, operator.email)
  for (const body of [{}, { roleIds: ['unknown'] }, { roleIds: [roles.editor, roles.editor] }, { roleIds: 'admin' }]) {
    expect((await request.patch(url(target.id), { data: body })).status()).toBe(400)
  }
  expect((await memberships(target.id)).map(link => link.roleId)).toEqual([roles.member])
  await db.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } })
  expect((await request.patch(url(target.id), { data: { roleIds: [] } })).status()).toBe(404)
  expect((await request.patch(url('missing-user'), { data: { roleIds: [] } })).status()).toBe(404)
  expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
})

test('a deleted administrator does not permit removal of the last active administrator', async ({ request }) => {
  const operator = await user(['admin'])
  const deleted = await user(['admin'])
  await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
  await authenticate(request, operator.email)
  const response = await request.patch(url(operator.id), { data: { roleIds: [roles.member] } })
  expect(response.status()).toBe(409)
  expect((await response.json()).message).toContain('最后')
  expect((await memberships(operator.id)).map(link => link.roleId)).toEqual([roles.admin])
})

test('concurrent administrators cannot remove each other and leave no administrator', async () => {
  const first = await user(['admin'])
  const second = await user(['admin'])
  const a = await clientFor(first.email)
  const b = await clientFor(second.email)
  const responses = await Promise.all([
    a.patch(url(second.id), { data: { roleIds: [] } }),
    b.patch(url(first.id), { data: { roleIds: [] } }),
  ])
  expect(responses.map(response => response.status()).sort()).toEqual([200, 403])
  expect(await db.userRole.count({ where: { roleId: roles.admin, user: { deletedAt: null } } })).toBe(1)
  expect(await db.auditLog.count({ where: { userId: { in: [first.id, second.id] }, action: 'USER_ROLE_UPDATE' } })).toBe(1)
})

test('audit insertion failure rolls the actual role transaction back', async ({ request }) => {
  const operator = await user(['admin'])
  const target = await user(['member'])
  await authenticate(request, operator.email)
  const trigger = `audit_test_${randomUUID().replaceAll('-', '')}`
  // Names and IDs are generated internally. This trigger exists only in the guarded isolated database.
  executeTestDDL(`CREATE TRIGGER ${trigger} BEFORE INSERT ON AuditLog FOR EACH ROW BEGIN
    IF NEW.action = 'USER_ROLE_UPDATE' AND NEW.target = '${target.id}' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test audit insertion failure';
    END IF;
  END`)
  try {
    const response = await request.patch(url(target.id), { data: { roleIds: [roles.editor] } })
    expect(response.status()).toBe(500)
    expect(await response.text()).not.toContain('Test audit insertion failure')
    expect((await memberships(target.id)).map(link => link.roleId)).toEqual([roles.member])
    expect(await db.auditLog.count({ where: { target: target.id } })).toBe(0)
  } finally { executeTestDDL(`DROP TRIGGER ${trigger}`) }
})

test('concurrent self-demotions preserve one active administrator', async () => {
  const first = await user(['admin'])
  const second = await user(['admin'])
  const a = await clientFor(first.email)
  const b = await clientFor(second.email)
  const responses = await Promise.all([
    a.patch(url(first.id), { data: { roleIds: [roles.member] } }),
    b.patch(url(second.id), { data: { roleIds: [roles.member] } }),
  ])
  expect(responses.map(response => response.status()).sort()).toEqual([200, 409])
  expect(await db.userRole.count({ where: { roleId: roles.admin, user: { deletedAt: null } } })).toBe(1)
})

test('role loading failures are visible and recoverable without changing memberships', async ({ page }) => {
  const operator = await user(['admin'])
  const target = await user(['member'])
  await authenticate(page.context().request, operator.email)
  await page.goto('/admin/users')
  await page.route('**/api/auth/roles', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ code: 5000, message: '获取角色列表失败', data: null }),
  }))
  await page.getByRole('button', { name: `分配角色：${target.email}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '分配用户角色' })
  await expect(dialog.getByRole('alert')).toContainText('获取角色列表失败')
  await expect(dialog.getByRole('button', { name: '保存角色', exact: true })).toHaveCount(0)
  await page.unroute('**/api/auth/roles')
  await dialog.getByRole('button', { name: '重试', exact: true }).click()
  await expect(dialog.getByRole('checkbox', { name: '普通会员', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect((await memberships(target.id)).map(link => link.roleId)).toEqual([roles.member])
  expect(await db.auditLog.count({ where: { target: target.id } })).toBe(0)
})

test('self-demotion refreshes the page permissions while keeping the same signed-in user', async ({ page }) => {
  const operator = await user(['admin'])
  await user(['admin'])
  await authenticate(page.context().request, operator.email)
  await page.goto('/admin/users')
  await page.getByRole('button', { name: `分配角色：${operator.email}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '分配用户角色' })
  await dialog.getByRole('checkbox', { name: '管理员', exact: true }).uncheck()
  await dialog.getByRole('checkbox', { name: '普通会员', exact: true }).check()
  await dialog.getByRole('button', { name: '保存角色', exact: true }).click()
  await expect(page.getByText(/此账号没有访问该页面的权限。|当前账号尚未获得管理权限，请联系博主。/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^分配角色：/ })).toHaveCount(0)
  const session = await (await page.context().request.get('/api/auth/session')).json()
  expect(session.user.id).toBe(operator.id)
  expect((await page.context().request.get('/api/auth/roles')).status()).toBe(403)
})

test('administrator assigns roles in the UI and sees last-admin errors without losing edits', async ({ page }) => {
  const operator = await user(['admin'])
  const target = await user(['member'])
  await authenticate(page.context().request, operator.email)
  await page.goto('/admin/users')
  await page.getByRole('button', { name: `分配角色：${target.email}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '分配用户角色' })
  await expect(dialog.getByRole('checkbox', { name: '普通会员', exact: true })).toBeChecked()
  await dialog.getByRole('checkbox', { name: '普通会员', exact: true }).uncheck()
  await dialog.getByRole('checkbox', { name: '编辑者', exact: true }).check()
  await dialog.getByRole('checkbox', { name: '审核者', exact: true }).check()
  await dialog.getByRole('button', { name: '保存角色', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: target.email, exact: true }) })
  await expect(row.getByText('编辑者', { exact: true })).toBeVisible()
  await expect(row.getByText('审核者', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `分配角色：${operator.email}`, exact: true }).click()
  await dialog.getByRole('checkbox', { name: '管理员', exact: true }).uncheck()
  await dialog.getByRole('button', { name: '保存角色', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('最后一位有效管理员')
  await expect(dialog.getByRole('checkbox', { name: '管理员', exact: true })).not.toBeChecked()
  await page.screenshot({ path: test.info().outputPath('role-assignment.png'), fullPage: true })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect((await memberships(operator.id)).map(link => link.roleId)).toEqual([roles.admin])
})
