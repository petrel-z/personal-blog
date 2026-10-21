import { expect, test, type Page } from '@playwright/test'
import { article, deferSearch, respond, searchResponse } from './search-fixtures'

const input = (page: Page) => page.getByLabel('搜索关键词', { exact: true })
const options = (page: Page) => page.getByRole('option')
const selected = (page: Page) => page.getByRole('option', { selected: true })

async function search(page: Page, keyword = '权限') {
  await input(page).fill(keyword)
  await input(page).press('Enter')
}

test.beforeEach(async ({ context, page }) => {
  // Mock only HTTP boundaries; exercise the real components and Next.js router.
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const match = path.match(/^\/api\/posts\/post-(\d+)$/)
    const data = match ? {
      ...article(Number(match[1])), content: '# 文章正文\n\n测试内容。',
      createdAt: '2026-10-20T00:00:00Z', category: null, tags: [],
      viewCount: 0, likeCount: 0, commentCount: 0,
    } : path.endsWith('/like') ? { liked: false, likeCount: 0 } : []
    return route.fulfill({ json: path === '/api/search'
      ? searchResponse([article(1), article(2, { slug: 'different-slug' }), article(3)])
      : path === '/api/posts' || path === '/api/comments' ? searchResponse([])
      : { code: 2000, message: 'success', data, timestamp: 0 } })
  })
  await context.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>',
  }))
  await page.goto('/about')
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
})

test('clicking a result opens its ID-based article and closes search, including on the same article', async ({ page }) => {
  await search(page)
  const result = options(page).nth(1)
  await expect(result).toHaveAttribute('href', '/post/post-2')
  await result.click()
  await expect(page).toHaveURL('/post/post-2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '权限文章 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await expect(input(page)).toHaveValue('')
  await search(page)
  await options(page).nth(1).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL('/post/post-2')
})

test('arrows keep focus in the combobox, clamp selection, and Enter opens the selected result', async ({ page }) => {
  await search(page)
  await expect(options(page)).toHaveCount(3)
  await expect(selected(page)).toHaveCount(0)
  await input(page).press('Enter')
  await expect(page).toHaveURL('/about')
  await expect(input(page)).toHaveRole('combobox')
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true')
  await input(page).press('ArrowDown')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-1')
  await input(page).press('ArrowUp')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-1')
  for (let i = 0; i < 3; i++) await input(page).press('ArrowDown')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-3')
  await input(page).press('ArrowUp')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-2')
  await expect(input(page)).toBeFocused()
  await expect(input(page)).toHaveAttribute('aria-activedescendant', (await selected(page).getAttribute('id'))!)
  await expect(page.getByRole('listbox', { name: '搜索结果' })).toHaveAttribute('id', (await input(page).getAttribute('aria-controls'))!)
  await input(page).press('Enter')
  await expect(page).toHaveURL('/post/post-2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('editing a query clears selection even if the next response contains the same article', async ({ page }) => {
  await search(page)
  await expect(options(page)).toHaveCount(3)
  await input(page).press('ArrowDown')
  await expect(selected(page)).toHaveCount(1)
  await search(page, '新关键词')
  await expect(options(page)).toHaveCount(3)
  await expect(selected(page)).toHaveCount(0)
  await expect(input(page)).not.toHaveAttribute('aria-activedescendant')
  await input(page).press('Enter')
  await expect(page).toHaveURL('/about')
})

test('clear and closing both reset keyboard selection', async ({ page }) => {
  for (const action of ['清空关键词', '关闭搜索']) {
    await search(page)
    await expect(options(page)).toHaveCount(3)
    await input(page).press('ArrowDown')
    await expect(selected(page)).toHaveCount(1)
    await page.getByRole('button', { name: action, exact: true }).click()
    if (action === '关闭搜索') await page.getByRole('button', { name: '搜索文章', exact: true }).click()
    await expect(input(page)).toHaveValue('')
    await expect(input(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(input(page)).not.toHaveAttribute('aria-activedescendant')
    await input(page).press('ArrowDown')
    await input(page).press('Enter')
    await expect(page).toHaveURL('/about')
  }
})

test('IME confirmation and candidate keys never select or open an article', async ({ page }) => {
  await search(page)
  await expect(options(page)).toHaveCount(3)
  await input(page).press('ArrowDown')
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) {
    await input(page).dispatchEvent('keydown', { key, isComposing: true })
    await input(page).dispatchEvent('keydown', { key, keyCode: 229 })
  }
  await expect(selected(page)).toHaveAttribute('href', '/post/post-1')
  await expect(page).toHaveURL('/about')
  await input(page).dispatchEvent('compositionstart')
  await input(page).fill('中文')
  await input(page).press('ArrowDown')
  await input(page).press('Enter')
  await expect(options(page)).toHaveCount(0)
  await input(page).dispatchEvent('compositionend', { data: '中文' })
  await input(page).dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
  await expect(page).toHaveURL('/about')
  await expect(selected(page)).toHaveCount(0)
})

test('loading, empty and failed searches cannot open an old selection', async ({ page }) => {
  await search(page)
  await expect(options(page)).toHaveCount(3)
  await input(page).press('ArrowDown')
  await deferSearch(page)
  await search(page, '新查询')
  await input(page).press('ArrowDown')
  await input(page).press('Enter')
  await expect(page).toHaveURL('/about')
  await respond(page, 0, searchResponse([]))
  await expect(page.getByRole('status')).toContainText('没有找到')
  await input(page).press('ArrowUp')
  await input(page).press('Enter')
  await expect(page).toHaveURL('/about')
  await search(page, '异常查询')
  await respond(page, 1, { code: 5000, message: '失败', data: null })
  await expect(page.getByRole('status')).toContainText('搜索失败')
  await input(page).press('ArrowDown')
  await input(page).press('Enter')
  expect(await page.evaluate(() => window.pendingSearches.length)).toBe(3)
  await expect(page).toHaveURL('/about')
})

test('ArrowUp starts at the last result and scrolls only the results on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 300 })
  await page.route('**/api/search?*', route => route.fulfill({ json: searchResponse(
    Array.from({ length: 10 }, (_, i) => article(i + 1)),
  ) }))
  await search(page)
  await expect(options(page)).toHaveCount(10)
  const backgroundScroll = await page.locator('main').evaluate(element => element.scrollTop)
  await input(page).press('ArrowUp')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-10')
  await expect(selected(page).getByRole('heading')).toBeInViewport()
  await expect(input(page)).toBeFocused()
  await expect(input(page)).toBeInViewport()
  await expect(page.getByRole('button', { name: '关闭搜索' })).toBeInViewport()
  expect(await page.locator('main').evaluate(element => element.scrollTop)).toBe(backgroundScroll)
  for (let i = 0; i < 9; i++) await input(page).press('ArrowUp')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-1')
  await expect(selected(page).getByRole('heading')).toBeInViewport()
})

test('pagination keeps selection and newly appended articles can be opened', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await respond(page, 0, searchResponse(Array.from({ length: 10 }, (_, i) => article(i + 1)), 11))
  await expect(options(page)).toHaveCount(10)
  await input(page).press('ArrowUp')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-10')
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await expect(selected(page)).toHaveAttribute('href', '/post/post-10')
  await respond(page, 1, searchResponse([article(11)], 11, 2))
  await expect(options(page)).toHaveCount(11)
  await expect(selected(page)).toHaveAttribute('href', '/post/post-10')
  await input(page).press('ArrowDown')
  await expect(selected(page)).toHaveAttribute('href', '/post/post-11')
  await input(page).press('Enter')
  await expect(page).toHaveURL('/post/post-11')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const gesture of ['modifier', 'middle'] as const) {
  test(`${gesture} click opens a new tab and preserves the current search`, async ({ page, context }) => {
    await search(page)
    await expect(options(page)).toHaveCount(3)
    // Native new-tab gestures may create a page without a window.opener.
    const popupPromise = context.waitForEvent('page')
    await options(page).nth(1).click(gesture === 'middle' ? { button: 'middle' } : { modifiers: ['ControlOrMeta'] })
    const popup = await popupPromise
    await expect(popup).toHaveURL('/post/post-2')
    await expect(page).toHaveURL('/about')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(input(page)).toHaveValue('权限')
    await popup.close()
  })
}

test('browser back closes an open search when the route changes', async ({ page }) => {
  await search(page)
  await options(page).first().click()
  await expect(page).toHaveURL('/post/post-1')
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await search(page)
  await expect(options(page)).toHaveCount(3)
  await page.goBack()
  await expect(page).toHaveURL('/about')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('an article removed after searching uses the existing unavailable-article page', async ({ page }) => {
  await page.route('**/api/posts/post-2', route => route.fulfill({
    status: 404, json: { code: 4004, message: '文章不存在', data: null },
  }))
  await search(page)
  await options(page).nth(1).click()
  await expect(page).toHaveURL('/post/post-2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '文章不存在' })).toBeVisible()
})
