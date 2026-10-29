import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'

let userId: string
let postId: string
const email = `ui-${randomUUID()}@example.com`
test.beforeAll(async () => {
  const user = await makeUser(email)
  userId = user.id
  const role = await db.role.upsert({ where: { name: 'admin' }, create: { name: 'admin' }, update: {} })
  await db.userRole.create({ data: { userId, roleId: role.id } })
  const post = await db.post.create({ data: { title: '在日常中，发现值得记录的微光', slug: `ui-${randomUUID()}`, content: '# 日常与思考\n\n把每个值得记住的瞬间，认真写下来。', status: 'PUBLISHED', authorId: userId, viewCount: 128, publishedAt: new Date() } })
  postId = post.id
})
test.afterAll(async () => {
  await db.post.deleteMany({ where: { authorId: userId } })
  await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
})

for (const width of [1440, 390]) {
  test(`all redesigned routes render without page overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height: 1000 })
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    for (const route of ['login', 'register', 'forgot-password', 'forbidden']) {
      await page.goto(`/${route}`)
      await expect(page.locator('h1')).toBeVisible()
      if (route !== 'forbidden') await expect(page.getByRole('img', { name: /验证码/ })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `output/admin-implementation/${width}-${route}.png`, fullPage: true })
    }
    const captcha = await getCaptcha(page.request, 'login')
    const result = await login(page.request, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
    expect(result.searchParams.has('error')).toBe(false)
    for (const route of ['dashboard', 'posts', 'posts/new', `posts/${postId}`, 'categories', 'tags', 'comments', 'stats/views', 'stats/popular', 'users', 'roles', 'sensitive-words', 'audit-logs', 'settings']) {
      await page.goto(`/admin/${route}`)
      await expect(page.locator('main h1').first()).toBeVisible()
      if (route.startsWith('posts/')) await expect(page.getByRole('textbox', { name: '文章正文' })).toBeVisible()
      await expect(page.locator('.admin-state').filter({ hasText: /加载|打开/ })).toHaveCount(0)
      await expect(page.locator('main [role="alert"]')).toHaveCount(0)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `output/admin-implementation/${width}-${route.replaceAll('/', '-')}.png`, fullPage: true })
    }
    if (width === 390) {
      const trigger = page.getByRole('button', { name: '打开导航' })
      await trigger.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
    expect(failures).toEqual([])
  })
}

test('editor preserves a failed save and restores a tab draft after reload', async ({ page }) => {
  const captcha = await getCaptcha(page.request, 'login')
  await login(page.request, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
  await page.goto('/admin/posts/new')
  await page.getByLabel('文章标题', { exact: true }).fill('尚未保存的创作')
  await page.getByRole('textbox', { name: '文章正文' }).fill('需要保留的正文内容')
  await page.route('**/api/posts', route => route.fulfill({ status: 500, json: { code: 5000, message: '测试保存失败' } }))
  await page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('测试保存失败')
  await expect(page.getByLabel('文章标题', { exact: true })).toHaveValue('尚未保存的创作')
  page.on('dialog', dialog => dialog.accept())
  await page.reload()
  await page.getByRole('button', { name: '恢复草稿', exact: true }).click()
  await expect(page.getByLabel('文章标题', { exact: true })).toHaveValue('尚未保存的创作')
  await expect(page.getByRole('textbox', { name: '文章正文' })).toHaveText('需要保留的正文内容')
  await page.unroute('**/api/posts')
  await page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/(?!new)[^/]+$/)
  expect(await db.post.count({ where: { authorId: userId, title: '尚未保存的创作', status: 'DRAFT' } })).toBe(1)
})
