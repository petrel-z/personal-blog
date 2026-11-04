import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://turing.captcha.qcloud.com/TJCaptcha.js', route => route.fulfill({
    contentType: 'application/javascript', body: `window.TencentCaptcha = class {
      constructor(id, callback) { this.callback = callback }
      show() { const number = window.captchaCount = (window.captchaCount || 0) + 1;
        if (window.captchaPending) return;
        this.callback({ret: window.captchaReturn || 0, ticket: 'ticket-' + number, randstr: 'random-' + number}) }
      destroy() { window.captchaDestroyed = (window.captchaDestroyed || 0) + 1 }
    }`,
  }))
  // Old clients fetched a hidden image and pre-verified the ticket. These stubs
  // let the regression tests demonstrate that those calls are no longer needed.
  await page.route('**/api/captcha?*', route => route.fulfill({ contentType: 'image/svg+xml',
    headers: { 'X-Captcha-Id': 'old-image' }, body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
  await page.route('**/api/auth/password-reset/tencent-captcha', route => route.fulfill({ json: { code: 2000 } }))
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({
    json: { code: 2000, message: '如果该邮箱已注册，你将收到验证码', data: { retryAfterSeconds: 60 } },
  }))
})

test('mail request carries the ticket and does not pre-consume it in a separate request', async ({ page }) => {
  let separateChecks = 0
  page.on('request', request => { if (request.url().endsWith('/tencent-captcha')) separateChecks++ })
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  const sent = page.waitForRequest('**/api/auth/password-reset/request')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({ email: 'owner@example.com', ticket: 'ticket-1', randstr: 'random-1' })
  await expect(page.getByLabel('邮件验证码', { exact: true })).toBeVisible()
  expect(separateChecks).toBe(0)
})

test('mail failure stays on the request step and a retry gets a fresh ticket', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ status: 503,
    json: { code: 5030, message: '密码找回服务暂时不可用', data: null } }), { times: 1 })
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('暂时不可用')
  await expect(page.getByLabel('邮件验证码', { exact: true })).toHaveCount(0)
  const sent = page.waitForRequest('**/api/auth/password-reset/request')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  expect((await sent).postDataJSON().ticket).toBe('ticket-2')
  await expect(page.getByLabel('邮件验证码', { exact: true })).toBeVisible()
})

test('server rate limit starts a cooldown that survives reload', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ status: 429,
    json: { code: 4290, message: '申请过于频繁，请稍后重试', data: { retryAfterSeconds: 120 } } }))
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
})

test('development cooldown ignores an old long wait and expires after the new five-second wait', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => localStorage.setItem('password-reset:send-until', String(Date.now() + 815_000)))
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ status: 429,
    json: { code: 4290, message: '申请过于频繁，请稍后重试', data: { retryAfterSeconds: 5 } } }))
  await page.goto('/forgot-password')
  await expect(page.getByRole('button', { name: '发送邮件验证码', exact: true })).toBeEnabled()
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /秒后可发送/ })).toBeDisabled()
  await page.clock.fastForward(5001)
  await expect(page.getByRole('button', { name: '发送邮件验证码', exact: true })).toBeEnabled()
})

test('missing captcha script reports an error and releases the submit button', async ({ page }) => {
  await page.route('https://turing.captcha.qcloud.com/TJCaptcha.js', route => route.fulfill({
    contentType: 'application/javascript', body: '/* unavailable */',
  }))
  await page.goto('/forgot-password')
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('验证码')
  await expect(page.getByRole('button', { name: '发送邮件验证码', exact: true })).toBeEnabled()
})

test('cancelled verification releases submission without sending a mail request', async ({ page }) => {
  let requests = 0
  page.on('request', request => { if (request.url().endsWith('/password-reset/request')) requests++ })
  await page.goto('/forgot-password')
  await page.evaluate(() => { (window as unknown as { captchaReturn: number }).captchaReturn = 2 })
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('人机验证未完成')
  await expect(page.getByRole('button', { name: '发送邮件验证码', exact: true })).toBeEnabled()
  expect(requests).toBe(0)
})

test('captcha timeout destroys the widget and releases submission', async ({ page }) => {
  await page.clock.install()
  await page.goto('/forgot-password')
  await page.evaluate(() => { (window as unknown as { captchaPending: boolean }).captchaPending = true })
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await expect(page.getByRole('button', { name: '发送中…', exact: true })).toBeDisabled()
  await page.clock.fastForward(120_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('超时')
  await expect(page.getByRole('button', { name: '发送邮件验证码', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => (window as unknown as { captchaDestroyed: number }).captchaDestroyed)).toBe(1)
})

test('leaving the recovery page destroys an unfinished captcha widget', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.evaluate(() => { (window as unknown as { captchaPending: boolean }).captchaPending = true })
  await page.getByLabel('注册邮箱', { exact: true }).fill('owner@example.com')
  await page.getByRole('button', { name: '发送邮件验证码', exact: true }).click()
  await page.getByRole('link', { name: '返回登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => (window as unknown as { captchaDestroyed: number }).captchaDestroyed)).toBe(1)
})
