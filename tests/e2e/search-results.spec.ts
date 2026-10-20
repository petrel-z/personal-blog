import { expect, test, type Page } from '@playwright/test'
import { article, deferSearch, respond, searchResponse } from './search-fixtures'

const firstPage = Array.from({ length: 10 }, (_, index) => article(index + 1))
const results = (page: Page) => page.getByRole('list', { name: '搜索结果' })

async function search(page: Page, keyword = '权限') {
  await page.getByRole('searchbox').fill(keyword)
  await page.getByRole('searchbox').press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname
    return route.fulfill({ json: pathname === '/api/posts' || pathname === '/api/search'
      ? searchResponse([]) : { code: 2000, message: 'success', timestamp: 0, data: [] } })
  })
  await page.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>',
  }))
  await page.goto('/about')
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
})

test('renders titles, excerpts and metadata with all matching keywords highlighted', async ({ page }) => {
  await page.route('**/api/search?*', route => route.fulfill({ json: searchResponse([
    article(1, { title: 'React 与 REACT', excerpt: 'React 权限与 react 组件。', tags: [] }),
    article(2, { title: '其他文章', excerpt: '', category: null, tags: [] }),
  ]) }))
  await search(page, 'react')
  const list = results(page)
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('heading', { name: 'React 与 REACT' })).toBeVisible()
  await expect(list.locator('mark')).toHaveText(['React', 'REACT', 'React', 'react'])
  await expect(list).toContainText('开发')
  await expect(list).toContainText('暂无摘要')
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0)
})

test('renders HTML-like titles and code excerpts as inert text', async ({ page }) => {
  await page.route('**/api/search?*', route => route.fulfill({ json: searchResponse([article(1, {
    title: '<img src=x onerror="alert(1)"> 权限',
    excerpt: '权限说明 <script>alert(1)</script> 与 <img src=x onerror="alert(1)"> 接口权限。',
    tags: [],
  })]) }))
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs += 1; await dialog.dismiss() })
  await search(page)
  const list = results(page)
  await expect(list).toContainText('权限说明 <script>alert(1)</script> 与 <img src=x onerror="alert(1)"> 接口权限。')
  await expect(list.locator('mark')).toHaveText(['权限', '权限', '权限'])
  await expect(list.locator('img, script, a')).toHaveCount(0)
  expect(dialogs).toBe(0)
})

test('shows an in-progress search separately from an empty result', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await expect(page.getByRole('region', { name: '搜索内容' })).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('status')).toHaveText('正在搜索…')
  await expect(results(page)).toHaveCount(0)
  await respond(page, 0, searchResponse([]))
  await expect(page.getByRole('status')).toContainText('没有找到相关文章')
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0)
})

test('retries a failed first page with a button, keeping the keyword', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/search?*', route => {
    attempts += 1
    return attempts === 1
      ? route.fulfill({ status: 500, json: { code: 5000, message: '失败', data: null } })
      : route.fulfill({ json: searchResponse([article(1)]) })
  })
  await search(page)
  const retry = page.getByRole('button', { name: '重新搜索', exact: true })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(results(page).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('searchbox')).toHaveValue('权限')
  expect(attempts).toBe(2)
})

test('does not offer network retry for an invalid keyword', async ({ page }) => {
  await search(page, '文'.repeat(101))
  await expect(page.getByRole('status')).toContainText('最多为 100')
  await expect(page.getByRole('button', { name: '重新搜索', exact: true })).toHaveCount(0)
})

test('appends the next page once and stops at the last page', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await respond(page, 0, searchResponse(firstPage, 12))
  await expect(results(page).getByRole('listitem')).toHaveCount(10)
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  const loading = page.getByRole('button', { name: '加载中…', exact: true })
  await expect(loading).toBeDisabled()
  await loading.evaluate((button: HTMLButtonElement) => button.click())
  expect(await page.evaluate(() => window.pendingSearches.map(({ keyword, page }) => ({ keyword, page })))).toEqual([
    { keyword: '权限', page: 1 }, { keyword: '权限', page: 2 },
  ])
  await expect(results(page).getByRole('listitem')).toHaveCount(10)
  await respond(page, 1, searchResponse([article(11), article(12)], 12, 2))
  await expect(results(page).getByRole('listitem')).toHaveCount(12)
  await expect(results(page).getByRole('heading').last()).toHaveText('权限文章 12')
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0)
})

test('preserves previous results after a page failure and retries that same page', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await respond(page, 0, searchResponse(firstPage, 11))
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await respond(page, 1, { code: 5000, message: '服务器错误', data: null })
  await expect(results(page).getByRole('listitem')).toHaveCount(10)
  await expect(page.getByRole('alert')).toContainText('加载更多失败')
  await page.getByRole('button', { name: '重试加载', exact: true }).click()
  expect(await page.evaluate(() => window.pendingSearches[2].page)).toBe(2)
  await respond(page, 2, searchResponse([article(11)], 11, 2))
  await expect(results(page).getByRole('listitem')).toHaveCount(11)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('deduplicates articles that move between pages while the user is searching', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await respond(page, 0, searchResponse(firstPage, 11))
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await respond(page, 1, searchResponse([article(10), article(11)], 11, 2))
  await expect(results(page).getByRole('listitem')).toHaveCount(11)
  await expect(results(page).getByRole('heading', { name: '权限文章 10', exact: true })).toHaveCount(1)
})

test('ignores an old next-page response after changing the keyword', async ({ page }) => {
  await deferSearch(page)
  await search(page)
  await respond(page, 0, searchResponse(firstPage, 11))
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await search(page, 'React')
  expect(await page.evaluate(() => window.pendingSearches[1].signal?.aborted)).toBe(true)
  await respond(page, 2, searchResponse([article(30, { title: 'React 新文章', excerpt: 'React 介绍' })]))
  await respond(page, 1, searchResponse([article(11)], 11, 2))
  await expect(results(page).getByRole('listitem')).toHaveCount(1)
  await expect(results(page).getByRole('heading')).toHaveText('React 新文章')
  await expect(results(page).locator('mark').first()).toHaveText('React')
})

for (const action of ['clear', 'close']) {
  test(`${action} cancels pagination and removes old results`, async ({ page }) => {
    await deferSearch(page)
    await search(page)
    await respond(page, 0, searchResponse(firstPage, 11))
    await page.getByRole('button', { name: '加载更多', exact: true }).click()
    await page.getByRole('button', { name: action === 'clear' ? '清空关键词' : '关闭搜索' }).click()
    expect(await page.evaluate(() => window.pendingSearches[1].signal?.aborted)).toBe(true)
    await respond(page, 1, searchResponse([article(11)], 11, 2))
    if (action === 'close') await page.getByRole('button', { name: '搜索文章', exact: true }).click()
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(results(page)).toHaveCount(0)
  })
}

test('scrolls results inside a short mobile viewport while the input remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 300 })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.route('**/api/search?*', route => route.fulfill({ json: searchResponse(firstPage, 11) }))
  await search(page)
  await expect(results(page).getByRole('listitem')).toHaveCount(10)
  const region = page.getByRole('region', { name: '搜索内容' })
  const dimensions = await region.evaluate(element => ({ scroll: element.scrollHeight, client: element.clientHeight }))
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client)
  await region.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(page.getByRole('searchbox')).toBeInViewport()
  await expect(page.getByRole('button', { name: '关闭搜索' })).toBeInViewport()
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeInViewport()
  const bounds = await page.getByRole('dialog').boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(8)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(312)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(292)
})
