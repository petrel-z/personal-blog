import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // These UI tests exercise the real layout without relying on a running database.
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    const data = pathname === '/api/posts' || pathname === '/api/search'
      ? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }
      : []
    await route.fulfill({ json: { code: 2000, data, message: 'success', timestamp: 0 } })
  })
  await page.route('**/_next/image?*', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>',
  }))
  await page.goto('/about')
})

test('clicking the header opens a focused search dialog and Escape returns to the trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '搜索文章', exact: true })
  const dialog = page.getByRole('dialog', { name: '搜索文章' })

  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: '搜索关键词' })).toBeFocused()
  await expect(page).toHaveURL('/about')

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

for (const shortcut of ['Control+k', 'Meta+k']) {
  test(`${shortcut} opens search and restores the previously focused element`, async ({ page }) => {
    const originalFocus = page.getByRole('link', { name: '归档', exact: true })
    await originalFocus.focus()
    await page.keyboard.press(shortcut)

    const dialog = page.getByRole('dialog', { name: '搜索文章' })
    await expect(dialog.getByRole('combobox')).toBeFocused()
    // Repeating the shortcut should keep the existing dialog open and focus its input.
    await dialog.getByRole('button', { name: '关闭搜索' }).focus()
    await page.keyboard.press(shortcut)
    await expect(dialog.getByRole('combobox')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(originalFocus).toBeFocused()
  })
}

test('Tab stays within search and the close button closes it', async ({ page }) => {
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '搜索文章' })
  const input = dialog.getByRole('combobox')
  const close = dialog.getByRole('button', { name: '关闭搜索' })

  await page.keyboard.press('Shift+Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await close.click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: '搜索文章', exact: true })).toBeFocused()
})

test('opening search locks background scrolling and closing preserves the reading position', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  const main = page.locator('main')
  const scrollTop = await main.evaluate(element => {
    element.scrollTop = 100
    return element.scrollTop
  })
  expect(scrollTop).toBeGreaterThan(0)

  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.mouse.move(1000, 500)
  await page.mouse.wheel(0, 300)
  // Let the browser deliver the wheel event before inspecting scroll position.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await main.evaluate(element => element.scrollTop)).toBe(scrollTop)

  await page.mouse.click(1000, 500)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await main.evaluate(element => element.scrollTop)).toBe(scrollTop)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => main.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollTop)
})

test('typing and pressing Enter keep the current page open', async ({ page }) => {
  await page.getByRole('button', { name: '搜索文章', exact: true }).click()
  const input = page.getByRole('dialog').getByRole('combobox')
  await input.fill('接口权限 C++')
  await input.press('Enter')
  await expect(input).toHaveValue('接口权限 C++')
  await expect(page).toHaveURL('/about')
})

for (const pathname of ['/', '/archive']) {
  test(`search is available on ${pathname} without navigating away`, async ({ page }) => {
    await page.goto(pathname)
    await page.getByRole('button', { name: '搜索文章', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(pathname)
  })
}

test('the search dialog fits a narrow mobile screen and remains usable above the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const trigger = page.getByRole('button', { name: '搜索文章', exact: true })
  await expect(trigger).toBeInViewport()
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '搜索文章' })
  const input = dialog.getByRole('combobox')
  await expect(input).toBeFocused()
  await input.fill('搜索')
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(8)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(312)

  // A shortened viewport approximates the space available with a software keyboard.
  await page.setViewportSize({ width: 320, height: 300 })
  await expect(input).toBeInViewport()
  await expect(dialog.getByRole('button', { name: '关闭搜索' })).toBeInViewport()
  await dialog.getByRole('button', { name: '关闭搜索' }).click()
  await expect(dialog).not.toBeVisible()
})
