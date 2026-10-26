import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'
import { PERMISSIONS } from '../../src/shared/permissions'

const emails: string[] = []
const temporaryRoleIds: string[] = []
const addedGrants: { roleId: string; permissionId: string }[] = []

async function builtinRole(name: string) {
  return db.role.upsert({ where: { name }, create: { name }, update: {} })
}

async function addGrant(roleId: string, code: string) {
  const permission = await db.permission.upsert({ where: { code }, create: { code }, update: {} })
  const key = { roleId, permissionId: permission.id }
  if (!await db.rolePermission.findUnique({ where: { roleId_permissionId: key } })) {
    await db.rolePermission.create({ data: key })
    addedGrants.push(key)
  }
}

async function createUser() {
  const email = `roles-${randomUUID()}@example.com`
  emails.push(email)
  return makeUser(email)
}

async function signIn(request: APIRequestContext, email: string) {
  const captcha = await getCaptcha(request, 'login')
  const destination = await login(request, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
  expect(destination.searchParams.has('error')).toBe(false)
}

test.afterEach(async () => {
  if (addedGrants.length) await db.rolePermission.deleteMany({ where: { OR: addedGrants } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.role.deleteMany({ where: { id: { in: temporaryRoleIds } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: emails.map(emailKey) } } })
  emails.length = 0
  temporaryRoleIds.length = 0
  addedGrants.length = 0
})
test.afterAll(async () => { await db.$disconnect() })

for (const mode of ['admin', 'reader'] as const) {
  test(`${mode} can read user role labels, including multiple, missing and legacy roles`, async ({ page }) => {
    const viewer = await createUser()
    const multiple = await createUser()
    const member = await createUser()
    const unassigned = await createUser()
    const legacyUser = await createUser()
    const deleted = await createUser()
    await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })

    const builtin = new Map<string, string>()
    for (const name of ['admin', 'editor', 'reviewer', 'member']) {
      const role = await db.role.upsert({ where: { name }, create: { name }, update: {} })
      builtin.set(name, role.id)
    }
    const permission = await db.permission.upsert({ where: { code: 'user:read' }, create: { code: 'user:read' }, update: {} })
    const legacy = await db.role.create({ data: {
      name: `legacy-${randomUUID()}`,
      rolePermissions: { create: { permissionId: permission.id } },
    } })
    temporaryRoleIds.push(legacy.id)
    await db.userRole.createMany({ data: [
      { userId: viewer.id, roleId: mode === 'admin' ? builtin.get('admin')! : legacy.id },
      { userId: multiple.id, roleId: builtin.get('editor')! },
      { userId: multiple.id, roleId: builtin.get('reviewer')! },
      { userId: member.id, roleId: builtin.get('member')! },
      { userId: legacyUser.id, roleId: legacy.id },
    ] })

    const request = page.context().request
    await signIn(request, viewer.email)
    await page.goto('/admin/users')
    await expect(page.getByRole('columnheader', { name: '角色', exact: true })).toBeVisible()
    const row = (email: string) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: email, exact: true }) })
    await expect(row(multiple.email).getByText('编辑者', { exact: true })).toBeVisible()
    await expect(row(multiple.email).getByText('审核者', { exact: true })).toBeVisible()
    await expect(row(member.email).getByText('普通会员', { exact: true })).toBeVisible()
    await expect(row(unassigned.email).getByText('未分配', { exact: true })).toBeVisible()
    await expect(row(legacyUser.email).getByText(legacy.name, { exact: true })).toBeVisible()
    if (mode === 'admin') await expect(row(viewer.email).getByText('管理员', { exact: true })).toBeVisible()

    const response = await request.get('/api/auth/users')
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    const { data } = await response.json()
    for (const user of data) {
      expect(Object.keys(user).sort()).toEqual(['_count', 'createdAt', 'email', 'id', 'image', 'name', 'roles', 'updatedAt'])
      for (const role of user.roles) expect(Object.keys(role).sort()).toEqual(['id', 'name'])
    }
    expect(data.find((user: { id: string }) => user.id === multiple.id).roles).toEqual([
      { id: builtin.get('editor'), name: 'editor' }, { id: builtin.get('reviewer'), name: 'reviewer' },
    ])
    expect(data.find((user: { id: string }) => user.id === unassigned.id).roles).toEqual([])
    expect(data.some((user: { id: string }) => user.id === deleted.id)).toBe(false)

    // The client must show a failed request, rather than treating it as an empty successful list.
    await page.route('**/api/auth/users', route => route.fulfill({
      status: 500, contentType: 'application/json',
      body: JSON.stringify({ code: 5000, message: '获取用户列表失败', data: null, timestamp: Date.now() }),
    }))
    await page.reload()
    await expect(page.getByText('获取用户列表失败', { exact: true })).toBeVisible()
    await expect(page.getByText('暂无用户', { exact: true })).toHaveCount(0)
  })
}

test('visitors and signed-in users without user:read cannot read the list', async ({ request }) => {
  const anonymous = await request.get('/api/auth/users')
  expect(anonymous.status()).toBe(401)
  expect((await anonymous.json()).data).toBeNull()
  const user = await createUser()
  await signIn(request, user.email)
  const forbidden = await request.get('/api/auth/users')
  expect(forbidden.status()).toBe(403)
  expect(forbidden.headers()['cache-control']).toBe('private, no-store')
  expect((await forbidden.json()).data).toBeNull()
})

test('role management shows effective permissions and counts only active members', async ({ page }) => {
  const admin = await builtinRole('admin')
  const editor = await builtinRole('editor')
  await builtinRole('reviewer')
  const member = await builtinRole('member')
  const initialCount = await db.userRole.count({ where: { roleId: editor.id, user: { deletedAt: null } } })
  const viewer = await createUser()
  const active = await createUser()
  const deleted = await createUser()
  await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
  await db.userRole.createMany({ data: [
    { userId: viewer.id, roleId: admin.id }, { userId: active.id, roleId: editor.id }, { userId: deleted.id, roleId: editor.id },
  ] })
  await addGrant(editor.id, 'post:read')
  await addGrant(editor.id, 'role:update')
  await addGrant(member.id, 'post:read')

  const request = page.context().request
  await signIn(request, viewer.email)
  const response = await request.get('/api/auth/roles')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  const { data } = await response.json()
  expect(data.map((role: { name: string }) => role.name)).toEqual(['admin', 'editor', 'reviewer', 'member'])
  expect(data[0].permissions).toEqual(PERMISSIONS)
  expect(data[1].memberCount).toBe(initialCount + 1)
  expect(data[1].permissions).toContain('post:read')
  expect(data[1].permissions).not.toContain('role:update')
  expect(data[3].permissions).toEqual([])
  for (const role of data) {
    expect(Object.keys(role).sort()).toEqual(['description', 'id', 'memberCount', 'name', 'permissions'])
  }

  await page.goto('/admin/users')
  await page.getByRole('link', { name: '角色管理', exact: true }).click()
  await expect(page).toHaveURL('/admin/roles')
  const details = page.getByRole('region', { name: '角色详情' })
  await expect(details.getByRole('heading', { name: '管理员', exact: true })).toBeVisible()
  await expect(details.getByText('权限只读', { exact: true })).toBeVisible()
  await expect(details.getByRole('heading', { name: '用户与角色', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('role-management.png'), fullPage: true })
  await page.getByRole('button', { name: /^编辑者/ }).click()
  await expect(details.getByText(`有效成员：${initialCount + 1} 人`, { exact: true })).toBeVisible()
  await expect(details.getByText('查看文章', { exact: true })).toBeVisible()
  await expect(details.getByText('配置角色权限', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^普通会员/ }).click()
  await expect(details.getByText('权限只读', { exact: true })).toBeVisible()
  await expect(details.getByText('该角色暂无后台权限', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /保存|删除|编辑权限/ })).toHaveCount(0)

  await page.route('**/api/auth/roles', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ code: 5000, data: null }),
  }))
  await page.reload()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('获取角色列表失败')
  await expect(page.getByRole('region', { name: '角色详情' })).toHaveCount(0)
  await page.unroute('**/api/auth/roles')
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('region', { name: '角色详情' })).toBeVisible()
})

test('role management rejects visitors and readers even with a stored role:read grant', async ({ page }) => {
  const request = page.context().request
  expect((await request.get('/api/auth/roles')).status()).toBe(401)
  await page.goto('/admin/roles')
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  const viewer = await createUser()
  const role = await db.role.create({ data: { name: `role-reader-${randomUUID()}`, userRoles: { create: { userId: viewer.id } } } })
  temporaryRoleIds.push(role.id)
  await addGrant(role.id, 'user:read')
  await addGrant(role.id, 'role:read')
  await signIn(request, viewer.email)
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '角色管理', exact: true })).toHaveCount(0)
  const response = await request.get('/api/auth/roles')
  expect(response.status()).toBe(403)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect((await response.json()).data).toBeNull()
  let roleRequests = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/roles') roleRequests++ })
  await page.goto('/admin/roles')
  // The shared AuthProvider may show its denial before a streamed server redirect is mounted.
  await expect(page.getByText(/此账号没有访问该页面的权限。|当前账号尚未获得管理权限，请联系博主。/)).toBeVisible()
  await expect(page.getByRole('region', { name: '角色详情' })).toHaveCount(0)
  expect(roleRequests).toBe(0)
})

test('missing built-in roles are reported without recreating database records', async ({ page }) => {
  const admin = await builtinRole('admin')
  const reviewer = await builtinRole('reviewer')
  const viewer = await createUser()
  await db.userRole.create({ data: { userId: viewer.id, roleId: admin.id } })
  try {
    await db.role.update({ where: { id: reviewer.id }, data: { name: `missing-${randomUUID()}` } })
    const request = page.context().request
    await signIn(request, viewer.email)
    const response = await request.get('/api/auth/roles')
    expect(response.status()).toBe(200)
    expect((await response.json()).data.some((role: { name: string }) => role.name === 'reviewer')).toBe(false)
    await page.goto('/admin/roles')
    await expect(page.getByRole('main').getByRole('alert')).toContainText('审核者')
    await expect(page.getByRole('main').getByRole('alert')).toContainText('角色初始化')
    await expect(page.getByRole('button', { name: /^审核者/ })).toHaveCount(0)
    expect(await db.role.findUnique({ where: { name: 'reviewer' } })).toBeNull()
  } finally {
    await db.role.update({ where: { id: reviewer.id }, data: { name: 'reviewer' } })
  }
})
