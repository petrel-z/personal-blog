import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'

const email = `editor-${randomUUID()}@example.com`
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
let userId: string
let postId: string
const original = '# 原有标题\n\n前半段后半段\n\n- [x] 已完成\n\n| 名称 | 数值 |\n| --- | --- |\n| 示例 | 1 |\n\n```ts\nconst n = 1\n```\n\n<div>保留 HTML</div>\n'

test.beforeAll(async () => {
  const user = await makeUser(email)
  userId = user.id
  const role = await db.role.upsert({ where: { name: 'admin' }, create: { name: 'admin' }, update: {} })
  await db.userRole.create({ data: { userId, roleId: role.id } })
  const post = await db.post.create({ data: { authorId: userId, title: '图片编辑测试', slug: `editor-${randomUUID()}`, content: original, status: 'DRAFT' } })
  postId = post.id
})
test.afterAll(async () => {
  if (userId) {
    await db.post.deleteMany({ where: { authorId: userId } })
    await db.user.deleteMany({ where: { id: userId } })
  }
  await db.$disconnect()
})
test.beforeEach(async ({ page }) => {
  const captcha = await getCaptcha(page.request, 'login')
  await login(page.request, { email, password: testPassword, captchaId: captcha.id, captchaCode: captcha.code })
  page.on('dialog', dialog => dialog.accept())
  await page.route('**/editor-test-*.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.goto(`/admin/posts/${postId}`)
  await expect(page.getByRole('textbox', { name: '文章正文', exact: true })).toBeVisible({ timeout: 30_000 })
})

async function pasteImages(page: Page, names = ['pasted.png']) {
  await page.getByRole('textbox', { name: '文章正文', exact: true }).evaluate((element, args) => {
    const clipboardData = new DataTransfer()
    for (const name of args.names) clipboardData.items.add(new File([Uint8Array.from(atob(args.png), c => c.charCodeAt(0))], name, { type: 'image/png' }))
    clipboardData.setData('text/html', '<img src="https://example.com/clipboard.png">')
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
  }, { names, png })
}
async function placeCaret(page: Page, text: string, offset: number) {
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.evaluate((element, args) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node.textContent === args.text) {
        const selection = window.getSelection()!
        selection.removeAllRanges()
        const range = document.createRange()
        range.setStart(node, args.offset)
        range.collapse(true)
        selection.addRange(range)
        ;(element as HTMLElement).focus()
        return
      }
    }
    throw new Error('Text for caret not found')
  }, { text, offset })
}
async function selectText(page: Page, text: string, start: number, end: number) {
  await page.getByRole('textbox', { name: '文章正文', exact: true }).evaluate((element, args) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node.textContent === args.text) {
        const selection = window.getSelection()!
        selection.removeAllRanges()
        const range = document.createRange()
        range.setStart(node, args.start)
        range.setEnd(node, args.end)
        selection.addRange(range)
        ;(element as HTMLElement).focus()
        return
      }
    }
    throw new Error('Text for selection not found')
  }, { text, start, end })
}

test('pasted image appears at caret during upload, tracks typing and saves as Markdown', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await expect(editor).toHaveAttribute('contenteditable', 'true')
  let finish!: () => void
  const gate = new Promise<void>(resolve => { finish = resolve })
  await page.route('**/api/upload', async route => {
    await gate
    await route.fulfill({ json: { code: 2000, data: { url: '/editor-test-one.png' } } })
  })
  await placeCaret(page, '前半段后半段', 3)
  await pasteImages(page)
  await expect(editor.getByAltText('pasted.png')).toHaveAttribute('src', /^blob:/)
  await expect(page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true })).toBeDisabled()
  await page.getByRole('button', { name: '← 返回文章列表' }).click()
  await expect(page.getByRole('dialog', { name: '离开编辑器？' })).toBeVisible()
  await page.getByRole('button', { name: '继续编辑', exact: true }).click()
  await placeCaret(page, '前半段', 0)
  await page.keyboard.insertText('新增')
  finish()
  await expect(editor.getByAltText('pasted.png')).toHaveAttribute('src', '/editor-test-one.png')
  await page.getByRole('tab', { name: '源码', exact: true }).click()
  const source = page.getByRole('textbox', { name: 'Markdown 源码' })
  await expect(source).toHaveValue(/新增前半段!\[pasted.png\]\(\/editor-test-one.png\)后半段/)
  await expect(source).toHaveValue(/<div>保留 HTML<\/div>/)
  await page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true }).click()
  await expect(page.getByText('文章已保存', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: '文章正文', exact: true }).getByAltText('pasted.png')).toBeVisible()
})

test('opening and switching modes preserves untouched Markdown and supports rich formatting', async ({ page }) => {
  await expect(page.getByText('有未保存的修改', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: '源码', exact: true }).click()
  // This test may run after the persistence test; the database is the source of truth.
  const post = await db.post.findUniqueOrThrow({ where: { id: postId } })
  await expect(page.getByRole('textbox', { name: 'Markdown 源码' })).toHaveValue(post.content)
  await page.getByRole('tab', { name: '编辑', exact: true }).click()
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await expect(editor.locator('h1')).toHaveText('原有标题')
  await expect(editor.locator('table')).toContainText('示例')
  await expect(editor.locator('pre')).toContainText('const n = 1')
  await expect(page.getByText('有未保存的修改', { exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.screenshot({ path: 'output/editor-images/desktop-edit.png', fullPage: true })
})

test('failed upload preserves body, allows retry and orders multiple images', async ({ page }) => {
  await page.goto('/admin/posts/new')
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.fill('左右')
  await page.route('**/api/upload', route => route.fulfill({ status: 500, json: { code: 5000, message: '测试上传失败' } }))
  await placeCaret(page, '左右', 1)
  await pasteImages(page)
  await expect(page.locator('main').getByRole('alert')).toContainText('测试上传失败')
  await expect(editor.locator('img')).toHaveCount(0)
  await expect(editor).toHaveText('左右')
  await page.unroute('**/api/upload')
  let count = 0
  await page.route('**/api/upload', route => route.fulfill({ json: { code: 2000, data: { url: `/editor-test-${++count}.png` } } }))
  await placeCaret(page, '左右', 1)
  await pasteImages(page, ['first.png', 'second.png'])
  await expect(editor.locator('img:not(.ProseMirror-separator)')).toHaveCount(2)
  await expect(editor.locator('img[alt="first.png"]')).toHaveCount(1)
  await expect(editor.locator('img[alt="second.png"]')).toHaveCount(1)
  await expect(page.getByRole('tab', { name: '源码', exact: true })).toBeEnabled()
  await page.getByRole('tab', { name: '源码', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown 源码' })).toHaveValue(/左!\[first.png\][\s\S]*!\[second.png\][\s\S]*右/)
})

test('deleting pending uploads cancels insertion and completed images support undo', async ({ page }) => {
  await page.goto('/admin/posts/new')
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.fill('左右')
  let finish!: () => void
  const gate = new Promise<void>(resolve => { finish = resolve })
  await page.route('**/api/upload', async route => {
    await gate
    await route.fulfill({ json: { code: 2000, data: { url: '/editor-test-deleted.png' } } }).catch(() => {})
  })
  await placeCaret(page, '左右', 1)
  await pasteImages(page)
  await expect(editor.locator('.editor-upload-preview')).toBeVisible()
  await editor.getByRole('button', { name: '取消上传图片' }).click()
  await expect(editor.locator('.editor-upload-preview')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true })).toBeEnabled()
  await placeCaret(page, '左右', 1)
  await pasteImages(page)
  await expect(editor.locator('.editor-upload-preview')).toBeVisible()
  await editor.fill('替换后的正文')
  await expect(editor.locator('img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存草稿', exact: true }).filter({ visible: true })).toBeEnabled()
  finish()
  await page.unroute('**/api/upload')
  await page.route('**/api/upload', route => route.fulfill({ json: { code: 2000, data: { url: '/editor-test-undo.png' } } }))
  await placeCaret(page, '替换后的正文', 3)
  await pasteImages(page)
  await expect(editor.getByAltText('pasted.png')).toHaveAttribute('src', '/editor-test-undo.png')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(editor.locator('img')).toHaveCount(0)
  await expect(editor).toContainText('替换后的正文')
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(editor.getByAltText('pasted.png')).toBeVisible()
})

test('file selection preserves caret, invalid images are rejected and mobile fits', async ({ page }) => {
  await page.goto('/admin/posts/new')
  await page.setViewportSize({ width: 390, height: 844 })
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.fill('选图前选图后')
  await placeCaret(page, '选图前选图后', 3)
  await page.getByLabel('选择正文图片').setInputFiles({ name: 'unsupported.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.locator('main').getByRole('alert')).toContainText('仅支持')
  await expect(editor.locator('img:not(.ProseMirror-separator)')).toHaveCount(0)
  await page.route('**/api/upload', route => route.fulfill({ json: { code: 2000, data: { url: '/editor-test-picked.png' } } }))
  await page.getByLabel('选择正文图片').setInputFiles({ name: 'picked.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(editor.getByAltText('picked.png')).toHaveAttribute('src', '/editor-test-picked.png')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/editor-images/mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: 'output/editor-images/desktop.png', fullPage: true })
  await page.getByRole('tab', { name: '源码', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown 源码' })).toHaveValue(/选图前!\[picked.png\].*选图后/)
})

test('pasting over a selection replaces the selected text', async ({ page }) => {
  await page.goto('/admin/posts/new')
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.fill('前面选中的文字后面')
  await selectText(page, '前面选中的文字后面', 2, 7)
  await page.route('**/api/upload', route => route.fulfill({ json: { code: 2000, data: { url: '/editor-test-selection.png' } } }))
  await pasteImages(page, ['selection.png'])
  await expect(editor.getByAltText('selection.png')).toHaveAttribute('src', '/editor-test-selection.png')
  await page.getByRole('tab', { name: '源码', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown 源码' })).toHaveValue(/前面!\[selection.png\]\(\/editor-test-selection.png\)后面/)
})

test('plain text paste works and drafts restore into the visual editor', async ({ page }) => {
  await page.goto('/admin/posts/new')
  const editor = page.getByRole('textbox', { name: '文章正文', exact: true })
  await editor.fill('草稿')
  await placeCaret(page, '草稿', 2)
  await editor.evaluate(element => {
    const data = new DataTransfer()
    data.setData('text/plain', '继续写作')
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
  })
  await expect(editor).toContainText('草稿继续写作')
  await page.reload()
  await expect(page.getByRole('dialog', { name: '发现未保存的草稿' })).toBeVisible()
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false')
  await page.getByRole('button', { name: '恢复草稿', exact: true }).click()
  await expect(editor).toHaveText('草稿继续写作')
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true')
})
