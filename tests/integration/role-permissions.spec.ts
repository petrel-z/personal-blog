import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'
import { setupAuthorization } from '../../scripts/setup-auth'

const users: { id: string; email: string }[] = []
const clients: APIRequestContext[] = []
let roles: Record<string, string>
let originalGrants: { roleId: string; permissionId: string }[]
const url = (name: string) => `/api/auth/roles/${roles[name] ?? name}/permissions`
const grants = async (name: string) => (await db.rolePermission.findMany({
  where: { roleId: roles[name] }, include: { permission: true },
})).map(link => link.permission.code).sort()

async function setGrants(name: string, codes: string[]) {
  const permissions = await Promise.all(codes.map(code => db.permission.upsert({ where: { code }, create: { code }, update: {} })))
  await db.rolePermission.deleteMany({ where: { roleId: roles[name] } })
  if (permissions.length) await db.rolePermission.createMany({ data: permissions.map(permission => ({ roleId: roles[name], permissionId: permission.id })) })
}
async function user(name: string) {
  const created = await makeUser(`permissions-${randomUUID()}@example.com`)
  users.push(created)
  await db.userRole.create({ data: { userId: created.id, roleId: roles[name] } })
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
  originalGrants = await db.rolePermission.findMany({ where: { roleId: { in: Object.values(roles) } }, select: { roleId: true, permissionId: true } })
  await setGrants('editor', ['post:read', 'post:update'])
  await setGrants('reviewer', ['comment:read'])
})
test.afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.dispose()))
  const ids = users.map(user => user.id)
  await db.auditLog.deleteMany({ where: { userId: { in: ids } } })
  await db.post.deleteMany({ where: { authorId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: users.map(user => emailKey(user.email)) } } })
  users.length = 0
  await db.$transaction(async tx => {
    await tx.rolePermission.deleteMany({ where: { roleId: { in: Object.values(roles) } } })
    if (originalGrants.length) await tx.rolePermission.createMany({ data: originalGrants })
  })
})
test.afterAll(async () => { await db.$disconnect() })

test('permission writes reject unauthorized callers, invalid codes and protected roles', async ({ request }) => {
  expect((await request.patch(url('editor'), { data: '{' })).status()).toBe(401)
  const editor = await user('editor')
  await setGrants('editor', ['post:read', 'role:update'])
  const editorClient = await clientFor(editor.email)
  expect((await editorClient.patch(url('editor'), { data: { permissions: [] } })).status()).toBe(403)
  const operator = await user('admin')
  await authenticate(request, operator.email)
  for (const body of [{}, { permissions: 'post:read' }, { permissions: ['post:read', 'post:read'] },
    { permissions: ['unknown'] }, ...['role:read', 'role:update', 'user:create', 'user:assign-role'].map(code => ({ permissions: [code] }))]) {
    expect((await request.patch(url('editor'), { data: body })).status()).toBe(400)
  }
  for (const name of ['admin', 'member']) {
    const before = await grants(name)
    expect((await request.patch(url(name), { data: { permissions: [] } })).status()).toBe(409)
    expect(await grants(name)).toEqual(before)
  }
  expect((await request.patch(url('missing'), { data: { permissions: [] } })).status()).toBe(404)
  expect(await grants('editor')).toEqual(['post:read', 'role:update'])
  expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
})

test('saved revocation applies to the same session next request and survives bootstrap', async ({ request }) => {
  const operator = await user('admin')
  const editor = await user('editor')
  const editorClient = await clientFor(editor.email)
  await authenticate(request, operator.email)
  const post = await db.post.create({ data: { authorId: editor.id, title: 'Permission fixture', slug: randomUUID(), content: 'Fixture' } })
  expect((await (await editorClient.patch(`/api/posts/${post.id}`, { data: { title: 'Before revocation' } })).json()).code).toBe(2000)
  const response = await request.patch(url('editor'), { data: { permissions: ['post:read'] } })
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect((await editorClient.patch(`/api/posts/${post.id}`, { data: { title: 'Must not change' } })).status()).toBe(403)
  expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).title).toBe('Before revocation')
  const audit = await db.auditLog.findMany({ where: { userId: operator.id, action: 'ROLE_PERMISSION_UPDATE' } })
  expect(audit).toHaveLength(1)
  expect(audit[0].target).toBe(roles.editor)
  expect(JSON.parse(audit[0].details!)).toEqual({ role: 'editor', before: ['post:read', 'post:update'], after: ['post:read'] })
  expect((await request.patch(url('editor'), { data: { permissions: ['post:read'] } })).status()).toBe(200)
  expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(1)
  await setupAuthorization(db, operator.email)
  expect(await grants('editor')).toEqual(['post:read'])
  expect((await request.patch(url('editor'), { data: { permissions: [] } })).status()).toBe(200)
  expect((await editorClient.get(`/api/posts/${post.id}`)).status()).toBe(403)
  await setupAuthorization(db, operator.email)
  expect(await grants('editor')).toEqual([])
  expect((await (await editorClient.get('/api/auth/session')).json()).user.id).toBe(editor.id)
})

test('audit insertion failure rolls permission changes back in the real database', async ({ request }) => {
  const operator = await user('admin')
  await authenticate(request, operator.email)
  const trigger = `permission_audit_${randomUUID().replaceAll('-', '')}`
  executeTestDDL(`CREATE TRIGGER ${trigger} BEFORE INSERT ON AuditLog FOR EACH ROW BEGIN
    IF NEW.action = 'ROLE_PERMISSION_UPDATE' AND NEW.userId = '${operator.id}' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test permission audit failure';
    END IF;
  END`)
  try {
    const response = await request.patch(url('editor'), { data: { permissions: ['comment:read'] } })
    expect(response.status()).toBe(500)
    expect(await response.text()).not.toContain('Test permission audit failure')
    expect(await grants('editor')).toEqual(['post:read', 'post:update'])
    expect(await db.auditLog.count({ where: { userId: operator.id } })).toBe(0)
  } finally { executeTestDDL(`DROP TRIGGER ${trigger}`) }
})

test('concurrent replacements produce complete grants and a continuous audit chain', async () => {
  const a = await clientFor((await user('admin')).email)
  const b = await clientFor((await user('admin')).email)
  const responses = await Promise.all([
    a.patch(url('reviewer'), { data: { permissions: ['post:read'] } }),
    b.patch(url('reviewer'), { data: { permissions: ['user:read', 'audit:read'] } }),
  ])
  expect(responses.map(response => response.status())).toEqual([200, 200])
  const logs = await db.auditLog.findMany({ where: { userId: { in: users.map(user => user.id) }, action: 'ROLE_PERMISSION_UPDATE' } })
  const details = logs.map(log => JSON.parse(log.details!) as { before: string[]; after: string[] })
  expect(details).toHaveLength(2)
  const first = details.find(log => JSON.stringify(log.before) === JSON.stringify(['comment:read']))!
  expect(first).toBeDefined()
  const second = details.find(log => log !== first)!
  expect(second.before).toEqual(first.after)
  expect(await grants('reviewer')).toEqual(second.after)
})

test('permission editor saves grouped selections, restores persisted state and explains empty grants', async ({ page }) => {
  await authenticate(page.context().request, (await user('admin')).email)
  await page.goto('/admin/roles')
  const details = page.getByRole('region', { name: '角色详情' })
  await expect(details.getByRole('button', { name: '编辑权限', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^普通会员/ }).click()
  await expect(details.getByRole('button', { name: '编辑权限', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^编辑者/ }).click()
  await details.getByRole('button', { name: '编辑权限', exact: true }).click()
  await expect(details.getByRole('checkbox', { name: '查看文章', exact: true })).toBeChecked()
  await expect(details.getByRole('checkbox', { name: '配置角色权限', exact: true })).toHaveCount(0)
  await expect(details.getByRole('checkbox', { name: '分配用户角色', exact: true })).toHaveCount(0)
  await details.getByRole('checkbox', { name: '编辑文章', exact: true }).uncheck()
  await details.getByRole('checkbox', { name: '查看评论', exact: true }).check()
  await page.screenshot({ path: test.info().outputPath('role-permission-editor.png'), fullPage: true })
  await details.getByRole('button', { name: '保存权限', exact: true }).click()
  await expect(page.getByRole('main').getByRole('status')).toHaveText('编辑者权限已更新')
  await expect(details.getByText('编辑文章', { exact: true })).toHaveCount(0)
  expect(await grants('editor')).toEqual(['comment:read', 'post:read'])
  await page.reload()
  await page.getByRole('button', { name: /^编辑者/ }).click()
  await details.getByRole('button', { name: '编辑权限', exact: true }).click()
  await expect(details.getByRole('checkbox', { name: '查看评论', exact: true })).toBeChecked()
  await details.getByRole('checkbox', { name: '查看评论', exact: true }).uncheck()
  await details.getByRole('checkbox', { name: '查看文章', exact: true }).uncheck()
  await expect(details.getByRole('alert')).toContainText('仅拥有此角色的用户将无法进入后台')
  await details.getByRole('button', { name: '保存权限', exact: true }).click()
  await expect(details.getByText('该角色暂无后台权限', { exact: true })).toBeVisible()
  expect(await grants('editor')).toEqual([])
})

test('failed saves retain edits, switching roles discards them, and pending saves lock controls', async ({ page }) => {
  await authenticate(page.context().request, (await user('admin')).email)
  await page.goto('/admin/roles')
  const details = page.getByRole('region', { name: '角色详情' })
  await page.getByRole('button', { name: /^编辑者/ }).click()
  await details.getByRole('button', { name: '编辑权限', exact: true }).click()
  await details.getByRole('checkbox', { name: '编辑文章', exact: true }).uncheck()
  await page.route('**/api/auth/roles/*/permissions', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ code: 5000, message: '权限保存失败，请重试', data: null }),
  }))
  await details.getByRole('button', { name: '保存权限', exact: true }).click()
  await expect(details.getByRole('alert')).toContainText('权限保存失败，请重试')
  await expect(details.getByRole('checkbox', { name: '编辑文章', exact: true })).not.toBeChecked()
  expect(await grants('editor')).toEqual(['post:read', 'post:update'])
  await page.unroute('**/api/auth/roles/*/permissions')
  await page.getByRole('button', { name: /^审核者/ }).click()
  await details.getByRole('button', { name: '编辑权限', exact: true }).click()
  await expect(details.getByRole('checkbox', { name: '查看评论', exact: true })).toBeChecked()
  await expect(details.getByRole('checkbox', { name: '查看文章', exact: true })).not.toBeChecked()
  await details.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('button', { name: /^编辑者/ }).click()
  await details.getByRole('button', { name: '编辑权限', exact: true }).click()
  await expect(details.getByRole('checkbox', { name: '编辑文章', exact: true })).toBeChecked()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/roles/*/permissions', async route => { await gate; await route.continue() })
  try {
    await details.getByRole('button', { name: '保存权限', exact: true }).click()
    await expect(details.getByRole('button', { name: '保存中...', exact: true })).toBeDisabled()
    await expect(details.getByRole('button', { name: '取消', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: /^审核者/ })).toBeDisabled()
    await expect(details.getByRole('checkbox', { name: '编辑文章', exact: true })).toBeDisabled()
  } finally { release() }
  await expect(page.getByRole('main').getByRole('status')).toHaveText('编辑者权限已更新')
})
