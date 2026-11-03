import { createHash, randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'

const email = `large-image-${randomUUID()}@example.com`
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
let userId: string
const directKeys: string[] = []

test.beforeAll(async () => {
  const user = await makeUser(email); userId = user.id
  const role = await db.role.upsert({ where: { name: 'admin' }, create: { name: 'admin' }, update: {} })
  await db.userRole.create({ data: { userId, roleId: role.id } })
})
test.afterAll(async () => {
  if (userId) {
    const tasks = await db.imageUploadTask.findMany({ where: { userId } })
    for (const task of tasks) {
      await rm(path.join(process.cwd(), '.data/image-uploads', task.id), { recursive: true, force: true })
      await rm(path.join(process.cwd(), 'public/uploads', task.objectKey), { force: true })
    }
    for (const key of directKeys) await rm(path.join(process.cwd(), 'public', key), { force: true })
    await db.imageUploadTask.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  }
  await db.$disconnect()
})
test.beforeEach(async ({ page }) => {
  const captcha = await getCaptcha(page.request, 'login')
  await login(page.request, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/admin/posts/new')
  await expect(page.getByRole('textbox', { name: '文章正文', exact: true })).toBeVisible({ timeout: 60000 })
})

test('a 6 MiB image uses the direct upload route', async ({ page }) => {
  const bytes = Buffer.alloc(6 * 1024 * 1024); png.copy(bytes)
  const sent: string[] = []
  page.on('request', request => { if (request.url().includes('/api/upload')) sent.push(new URL(request.url()).pathname) })
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/upload')
  await page.getByLabel('选择正文图片').setInputFiles({ name: 'direct.png', mimeType: 'image/png', buffer: bytes })
  const result = await (await response).json()
  directKeys.push(result.data.url)
  await expect(page.getByAltText('direct.png', { exact: true })).toHaveAttribute('src', result.data.url)
  expect(sent).toEqual(['/api/upload'])
})

test('a large image survives failed parts and page reload, then supports instant upload', async ({ page, playwright }) => {
  test.setTimeout(120000)
  const bytes = Buffer.alloc(10 * 1024 * 1024 + 1); png.copy(bytes)
  const file = { name: 'resumable.png', mimeType: 'image/png', buffer: bytes }
  await page.route('**/api/upload/multipart/*/parts/*', route => {
    if (route.request().url().endsWith('/parts/1')) return route.continue()
    return route.fulfill({ status: 503, json: { code: 5030, message: '测试网络中断', data: null } })
  })
  await page.getByLabel('选择正文图片').setInputFiles(file)
  await expect(page.locator('main').getByRole('alert')).toContainText('测试网络中断', { timeout: 30000 })
  const interrupted = await db.imageUploadTask.findFirstOrThrow({ where: { userId }, include: { parts: true } })
  expect(interrupted.parts.map(part => part.partNumber)).toEqual([1])
  await page.unroute('**/api/upload/multipart/*/parts/*')
  await page.reload()
  await page.getByRole('button', { name: '放弃备份，使用服务器内容' }).click()
  await expect(page.getByRole('textbox', { name: '文章正文', exact: true })).toBeVisible()
  const parts: number[] = []
  page.on('request', request => { const match = request.url().match(/\/parts\/(\d+)$/); if (match) parts.push(Number(match[1])) })
  await page.getByLabel('选择正文图片').setInputFiles(file)
  const image = page.getByAltText('resumable.png', { exact: true })
  await expect(image).toHaveAttribute('src', /^\/uploads\//, { timeout: 30000 })
  expect(parts.sort()).toEqual([2, 3])
  expect((await db.imageUploadTask.findUniqueOrThrow({ where: { id: interrupted.id } })).status).toBe('COMPLETED')
  expect((await readFile(path.join(process.cwd(), 'public/uploads', interrupted.objectKey))).equals(bytes)).toBe(true)
  parts.length = 0
  await page.getByLabel('选择正文图片').setInputFiles(file)
  await expect(page.getByRole('textbox', { name: '文章正文', exact: true }).locator('img[src^="/uploads/"]')).toHaveCount(2, { timeout: 30000 })
  await expect(page.locator('.editor-upload-preview')).toHaveCount(0)
  expect(parts).toEqual([])
  await page.screenshot({ path: 'output/image-uploads/resumed-and-instant.png', fullPage: true })

  // Even another administrator cannot probe this user's task or reuse its parts.
  const other = await makeUser(`other-image-${randomUUID()}@example.com`)
  const role = await db.role.findUniqueOrThrow({ where: { name: 'admin' } })
  await db.userRole.create({ data: { userId: other.id, roleId: role.id } })
  const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3017' })
  try {
    const captcha = await getCaptcha(request, 'login')
    await login(request, { email: other.email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
    expect((await request.get(`/api/upload/multipart/${interrupted.id}`)).status()).toBe(404)
    const initialized = await request.post('/api/upload/multipart', { data: { size: interrupted.fileSize,
      type: interrupted.fileType, fileHash: interrupted.fileHash, hashes: interrupted.partHashes } })
    expect(initialized.status()).toBe(200)
    expect((await initialized.json()).data).toMatchObject({ url: null, uploadedParts: [] })
  } finally {
    await request.dispose()
    await db.imageUploadTask.deleteMany({ where: { userId: other.id } })
    await db.user.delete({ where: { id: other.id } })
  }
})

test('exactly 10 MiB also uses multipart for the article cover', async ({ page }) => {
  const bytes = Buffer.alloc(10 * 1024 * 1024); png.copy(bytes)
  const sent: string[] = []
  page.on('request', request => { if (request.url().includes('/api/upload')) sent.push(new URL(request.url()).pathname) })
  await page.getByLabel('选择封面图片').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: bytes })
  await expect(page.getByAltText('文章封面', { exact: true })).toHaveAttribute('src', /^\/uploads\//, { timeout: 30000 })
  expect(sent).toContain('/api/upload/multipart')
  expect(sent).not.toContain('/api/upload')
})

test('real database completion repairs a damaged part and serializes competing completion requests', async ({ page }) => {
  const bytes = Buffer.alloc(10 * 1024 * 1024); png.copy(bytes); Buffer.from(randomUUID()).copy(bytes, png.length)
  const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
  const hashes = [digest(bytes.subarray(0, 5242880)), digest(bytes.subarray(5242880))]
  const initialized = await page.request.post('/api/upload/multipart', { data: { size: bytes.length, type: 'image/png', hashes,
    fileHash: digest(JSON.stringify([bytes.length, 5242880, hashes])) } })
  const { uploadId } = (await initialized.json()).data
  const base = `/api/upload/multipart/${uploadId}`
  expect((await page.request.post(`${base}/complete`)).status()).toBe(409)
  for (const number of [2, 1]) {
    const result = await page.request.put(`${base}/parts/${number}`, { data: bytes.subarray((number - 1) * 5242880, number * 5242880) })
    expect(result.status()).toBe(200)
  }
  await writeFile(path.join(process.cwd(), '.data/image-uploads', uploadId, '1'), 'damaged')
  expect((await page.request.post(`${base}/complete`)).status()).toBe(409)
  expect((await (await page.request.get(base)).json()).data.uploadedParts).toEqual([2])
  expect((await page.request.put(`${base}/parts/1`, { data: bytes.subarray(0, 5242880) })).status()).toBe(200)
  const completed = await Promise.all([page.request.post(`${base}/complete`), page.request.post(`${base}/complete`)])
  const statuses = completed.map(response => response.status())
  expect(statuses).toContain(200)
  expect(statuses.every(status => status === 200 || status === 409)).toBe(true)
  const final = await page.request.post(`${base}/complete`)
  expect(final.status()).toBe(200)
  const { url } = (await final.json()).data
  expect((await readFile(path.join(process.cwd(), 'public', url))).equals(bytes)).toBe(true)
})
