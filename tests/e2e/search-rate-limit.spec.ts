import { expect, test } from '@playwright/test'
import { article, deferSearch, respond, searchResponse } from './search-fixtures'

const limited = { code: 4290, message: '搜索过于频繁', data: null, timestamp: 0 }
const firstPage = Array.from({ length: 10 }, (_, i) => article(i + 1))

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/posts' || path === '/api/search'
      ? searchResponse([]) : { code: 2000, message: 'success', data: [], timestamp: 0 } })
  })
  await page.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>',
  }))
  await page.goto('/about')
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await page.clock.install({ time: new Date('2026-10-20T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-20T00:00:01Z'))
})

test('429 pauses typing, Enter and retry requests until Retry-After expires', async ({ page }) => {
  const keywords: string[] = []
  await page.route('**/api/search?*', route => {
    keywords.push(new URL(route.request().url()).searchParams.get('keyword')!)
    return keywords.length === 1
      ? route.fulfill({ status: 429, headers: { 'Retry-After': '3' }, json: limited })
      : route.fulfill({ json: searchResponse([article(1)]) })
  })
  const input = page.getByRole('combobox')
  await input.fill('权限')
  await input.press('Enter')
  await expect(page.getByRole('status')).toContainText('3 秒')
  await expect(page.getByRole('button', { name: '3 秒后重试' })).toBeDisabled()
  await input.press('Enter')
  await input.fill('新关键词')
  await page.clock.runFor(1000)
  await expect(page.getByRole('status')).toContainText('2 秒')
  await page.getByRole('button', { name: '清空关键词' }).click()
  await input.fill('最新关键词')
  await input.press('Enter')
  await page.clock.runFor(1999)
  expect(keywords).toEqual(['权限'])
  await page.clock.runFor(1)
  const retry = page.getByRole('button', { name: '重新搜索', exact: true })
  await expect(retry).toBeEnabled()
  expect(keywords).toEqual(['权限']) // No automatic retry when the timer ends.
  await retry.click()
  await expect(page.getByRole('option')).toHaveCount(1)
  expect(keywords).toEqual(['权限', '最新关键词'])
})

test('pagination rate limiting preserves results and retries the same page after waiting', async ({ page }) => {
  const pages: number[] = []
  await page.route('**/api/search?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    pages.push(current)
    return pages.length === 2
      ? route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: limited })
      : route.fulfill({ json: current === 1 ? searchResponse(firstPage, 11) : searchResponse([article(11)], 11, 2) })
  })
  await page.getByRole('combobox').fill('权限')
  await page.getByRole('combobox').press('Enter')
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(10)
  await expect(page.getByRole('alert')).toContainText('2 秒')
  await expect(page.getByRole('button', { name: '2 秒后重试' })).toBeDisabled()
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('option')).toHaveCount(10)
  await page.getByRole('combobox').press('ArrowDown')
  await expect(page.getByRole('option', { selected: true })).toHaveAttribute('href', '/post/post-1')
  await page.clock.runFor(2000)
  await page.getByRole('button', { name: '重试加载', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(11)
  expect(pages).toEqual([1, 2, 2])
})

test('a longer Retry-After from an upstream service is respected', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/search?*', route => {
    attempts += 1
    return route.fulfill({ status: 429, headers: { 'Retry-After': '120' }, json: limited })
  })
  await page.getByRole('combobox').fill('权限')
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toContainText('120 秒')
  await page.clock.runFor(60_000)
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('status')).toContainText('60 秒')
  expect(attempts).toBe(1)
})

for (const retryAfter of [undefined, 'invalid', '0', '-2']) {
  test(`429 with Retry-After ${retryAfter} uses a bounded fallback and can be retried`, async ({ page }) => {
    let attempts = 0
    await page.route('**/api/search?*', route => {
      attempts += 1
      return attempts === 1
        ? route.fulfill({ status: 429, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter }, json: limited })
        : route.fulfill({ json: searchResponse([article(1)]) })
    })
    await page.getByRole('combobox').fill('权限')
    await page.getByRole('combobox').press('Enter')
    await expect(page.getByRole('status')).toContainText('60 秒')
    await page.clock.runFor(60_000)
    await page.getByRole('combobox').press('Enter')
    await expect(page.getByRole('option')).toHaveCount(1)
    expect(attempts).toBe(2)
  })
}

test('a stale 429 response cannot put the current query into cooldown', async ({ page }) => {
  await deferSearch(page)
  const input = page.getByRole('combobox')
  await input.fill('旧关键词')
  await input.press('Enter')
  await input.fill('新关键词')
  await input.press('Enter')
  await respond(page, 1, searchResponse([article(1)]))
  await respond(page, 0, limited)
  await expect(page.getByRole('option')).toHaveCount(1)
  await input.fill('下一次搜索')
  await input.press('Enter')
  expect(await page.evaluate(() => window.pendingSearches.length)).toBe(3)
})
