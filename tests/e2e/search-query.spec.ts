import { expect, test, type Page } from '@playwright/test'

import { deferSearch, finishSearch, result } from './search-fixtures'

function trackRequests(page: Page) {
  const requests: URL[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/api/search') requests.push(url)
  })
  return requests
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname
    return route.fulfill({ json: pathname === '/api/search' || pathname === '/api/posts'
      ? result(pathname === '/api/search' ? 3 : 0)
      : { code: 2000, message: 'success', data: [], timestamp: 0 } })
  })
  await page.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>',
  }))
  await page.goto('/about')
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await expect(page.getByRole('combobox')).toBeFocused()
  await page.clock.install({ time: new Date('2026-10-20T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-20T00:00:01Z'))
})

test('waits 500ms after the last change and sends the trimmed literal keyword once', async ({ page }) => {
  const requests = trackRequests(page)
  const input = page.getByRole('combobox')
  await input.fill('接口')
  await page.clock.runFor(300)
  await input.fill('  接口 C++ & 100%_\\  ')
  await page.clock.runFor(499)
  expect(requests).toHaveLength(0)
  await page.clock.runFor(1)
  await expect(page.getByRole('status')).toHaveText('找到 3 篇相关文章')
  expect(requests).toHaveLength(1)
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({
    keyword: '接口 C++ & 100%_\\', page: '1', pageSize: '10',
  })
  await input.fill('接口 C++ & 100%_\\')
  await page.clock.runFor(1000)
  expect(requests).toHaveLength(1)
  await expect(page).toHaveURL('/about')
})

test('Enter searches immediately without duplicating pending or completed queries', async ({ page }) => {
  await deferSearch(page)
  const input = page.getByRole('combobox')
  await input.fill('React')
  await page.clock.runFor(100)
  await input.press('Enter')
  await expect(page.getByRole('status')).toHaveText('正在搜索…')
  await input.press('Enter')
  await page.clock.runFor(1000)
  expect(await page.evaluate(() => window.pendingSearches.length)).toBe(1)
  await finishSearch(page, 0, 8)
  await expect(page.getByRole('status')).toHaveText('找到 8 篇相关文章')
  await input.press('Enter')
  expect(await page.evaluate(() => window.pendingSearches.length)).toBe(1)
})

test('Chinese composition cancels pending work and searches only the confirmed text', async ({ page }) => {
  const requests = trackRequests(page)
  const input = page.getByRole('combobox')
  await input.fill('old')
  await input.dispatchEvent('compositionstart')
  await input.fill('zhong')
  await page.clock.runFor(1000)
  await input.press('Enter')
  expect(requests).toHaveLength(0)
  await input.fill('中文')
  await input.dispatchEvent('compositionend', { data: '中文' })
  // Some browsers emit the confirmation Enter after compositionend with keyCode 229.
  await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: false })
  await page.clock.runFor(499)
  expect(requests).toHaveLength(0)
  await page.clock.runFor(1)
  await expect(page.getByRole('status')).toHaveText('找到 3 篇相关文章')
  expect(requests.map(url => url.searchParams.get('keyword'))).toEqual(['中文'])
})

test('empty input, whitespace and clearing a debounce do not send requests', async ({ page }) => {
  const requests = trackRequests(page)
  const input = page.getByRole('combobox')
  await input.press('Enter')
  await input.fill('   ')
  await input.press('Enter')
  await page.clock.runFor(1000)
  await input.fill('清空前')
  await page.clock.runFor(499)
  await page.getByRole('button', { name: '清空关键词' }).click()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('')
  await page.clock.runFor(1000)
  expect(requests).toHaveLength(0)
  await expect(page.getByRole('status')).toHaveText('输入关键词搜索文章')
})

test('changing input aborts the old request immediately and ignores an out-of-order success', async ({ page }) => {
  await deferSearch(page)
  const input = page.getByRole('combobox')
  await input.fill('旧关键词')
  await input.press('Enter')
  await input.fill('新关键词')
  expect(await page.evaluate(() => window.pendingSearches[0].signal?.aborted)).toBe(true)
  await page.clock.runFor(500)
  await finishSearch(page, 1, 7)
  await expect(page.getByRole('status')).toHaveText('找到 7 篇相关文章')
  await finishSearch(page, 0, 99)
  await expect(page.getByRole('status')).toHaveText('找到 7 篇相关文章')
})

test('a late error cannot replace the next query loading state', async ({ page }) => {
  await deferSearch(page)
  const input = page.getByRole('combobox')
  await input.fill('旧关键词')
  await input.press('Enter')
  await input.fill('新关键词')
  await input.press('Enter')
  await page.evaluate(() => window.pendingSearches[0].resolve({ code: 5000, message: '请求已取消', data: null }))
  await expect(page.getByRole('status')).toHaveText('正在搜索…')
  await finishSearch(page, 1, 2)
  await expect(page.getByRole('status')).toHaveText('找到 2 篇相关文章')
})

test('clearing an in-flight query cancels it and ignores its eventual response', async ({ page }) => {
  await deferSearch(page)
  await page.getByRole('combobox').fill('清空前')
  await page.getByRole('combobox').press('Enter')
  await page.getByRole('button', { name: '清空关键词' }).click()
  expect(await page.evaluate(() => window.pendingSearches[0].signal?.aborted)).toBe(true)
  await finishSearch(page, 0, 99)
  await expect(page.getByRole('status')).toHaveText('输入关键词搜索文章')
  await expect(page.getByRole('combobox')).toBeFocused()
})

test('closing cancels the debounce and reopening starts with an empty input', async ({ page }) => {
  const requests = trackRequests(page)
  await page.getByRole('combobox').fill('关闭前')
  await page.keyboard.press('Escape')
  await page.clock.runFor(1000)
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await expect(page.getByRole('combobox')).toHaveValue('')
  await expect(page.getByRole('status')).toHaveText('输入关键词搜索文章')
})

test('closing aborts an active request and it cannot update the reopened dialog', async ({ page }) => {
  await deferSearch(page)
  await page.getByRole('combobox').fill('关闭前')
  await page.getByRole('combobox').press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await page.evaluate(() => window.pendingSearches[0].signal?.aborted)).toBe(true)
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await finishSearch(page, 0, 99)
  await expect(page.getByRole('status')).toHaveText('输入关键词搜索文章')
})

test('accepts a 100-character keyword and rejects longer input without a request', async ({ page }) => {
  const requests = trackRequests(page)
  const input = page.getByRole('combobox')
  await input.fill('文'.repeat(101))
  await input.press('Enter')
  await page.clock.runFor(1000)
  await expect(page.getByRole('status')).toHaveText('关键词最多为 100 个字符')
  expect(requests).toHaveLength(0)
  await input.fill(' ' + '文'.repeat(100) + ' ')
  await input.press('Enter')
  await expect(page.getByRole('status')).toHaveText('找到 3 篇相关文章')
  expect(requests[0].searchParams.get('keyword')).toBe('文'.repeat(100))
})

test('server errors can be retried with Enter and do not trigger a second debounce request', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/search?*', route => {
    attempts += 1
    return attempts === 1
      ? route.fulfill({ status: 500, json: { code: 5000, message: '搜索失败', data: null } })
      : route.fulfill({ json: result(4) })
  })
  await page.getByRole('combobox').fill('重试')
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toHaveText('搜索失败，请稍后按 Enter 重试')
  await page.clock.runFor(1000)
  expect(attempts).toBe(1)
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toHaveText('找到 4 篇相关文章')
  expect(attempts).toBe(2)
})

test('network failure is shown as an error, while a valid empty result is shown as no matches', async ({ page }) => {
  await page.route('**/api/search?*', route => route.abort('failed'))
  await page.getByRole('combobox').fill('网络')
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toHaveText('搜索失败，请稍后按 Enter 重试')
  await page.unroute('**/api/search?*')
  await page.route('**/api/search?*', route => route.fulfill({ json: result(0) }))
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toHaveText('没有找到相关文章，换个关键词试试')
})
