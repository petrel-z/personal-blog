import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

const emails: string[] = []
const temporaryRoleIds: string[] = []

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
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.role.deleteMany({ where: { id: { in: temporaryRoleIds } } })
  await db.loginAttempt.deleteMany({ where: { key: { in: emails.map(emailKey) } } })
  emails.length = 0
  temporaryRoleIds.length = 0
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
