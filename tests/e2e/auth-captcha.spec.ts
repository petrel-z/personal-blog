import { test, expect, type Page } from '@playwright/test'

async function captchaStub(page: Page) {
  let count = 0
  await page.route('**/api/captcha**', async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { code: 2000 } })
    }
    count++
    return route.fulfill({
      contentType: 'image/svg+xml', headers: { 'X-Captcha-Id': `captcha-${count}` },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="25">ABCD</text></svg>`,
    })
  })
  return () => count
}

test('password failure refreshes captcha and preserves credentials', async ({ page }) => {
  const count = await captchaStub(page)
  await page.route('**/api/auth/callback/credentials*', route => route.fulfill({
    json: { url: 'http://127.0.0.1:3017/login?error=CredentialsSignin&code=credentials' },
  }))
  await page.goto('/login')
  await page.getByRole('img', { name: '验证码' }).waitFor()
  const before = count()
  await page.getByLabel('邮箱', { exact: true }).fill('test@example.com')
  await page.getByLabel('密码', { exact: true }).fill('wrong-password')
  await page.getByPlaceholder('验证码', { exact: true }).fill('ABCD')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('邮箱或密码错误', { exact: true })).toBeVisible()
  await expect.poll(count).toBeGreaterThan(before)
  await expect(page.getByPlaceholder('验证码', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('test@example.com')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('wrong-password')
})

for (const path of ['/login', '/register']) {
  test(`manual refresh clears the input on ${path}`, async ({ page }) => {
    await captchaStub(page)
    await page.goto(path)
    await page.getByRole('img', { name: '验证码' }).waitFor()
    await page.getByPlaceholder('验证码', { exact: true }).fill('ABCD')
    await page.getByRole('button', { name: '刷新验证码' }).click()
    await expect(page.getByPlaceholder('验证码', { exact: true })).toHaveValue('')
  })
}

test('a failed refresh disables submission and exposes retry', async ({ page }) => {
  await captchaStub(page)
  await page.goto('/login')
  await page.getByRole('img', { name: '验证码' }).waitFor()
  await page.route('**/api/captcha**', route => route.fulfill({status:503, body:'unavailable'}))
  await page.getByRole('button', { name: '刷新验证码' }).click()
  await expect(page.getByText('验证码加载失败，请重试')).toBeVisible()
  await expect(page.getByRole('button', {name:'登录',exact:true})).toBeDisabled()
  await expect(page.getByRole('img', { name: '验证码' })).toHaveCount(0)
})

test('rapid refresh keeps the latest image and submitted id together', async ({ page }) => {
  let serial=0
  let delay=false
  const pending: Array<() => Promise<void>>=[]
  await page.route('**/api/captcha**', async route => {
    const id=`race-${++serial}`
    const respond=async () => { await route.fulfill({contentType:'image/svg+xml',headers:{'X-Captcha-Id':id},body:`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="25">${id}</text></svg>`}).catch(() => {}) }
    if(delay) pending.push(respond)
    else await respond()
  })
  let submitted=''
  await page.route('**/api/auth/callback/credentials*', async route => {
    submitted=new URLSearchParams(route.request().postData()!).get('captchaId') || ''
    await route.fulfill({json:{url:'http://127.0.0.1:3017/login?error=CredentialsSignin&code=credentials'}})
  })
  await page.goto('/login')
  await page.getByRole('img',{name:'验证码'}).waitFor()
  delay=true
  await page.getByRole('button',{name:'更换验证码图片'}).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => pending.length).toBeGreaterThan(0)
  const latest=`race-${serial}`
  delay=false
  for(const respond of pending.reverse()) await respond()
  await page.getByRole('img',{name:'验证码'}).waitFor()
  const svg=await page.getByRole('img',{name:'验证码'}).evaluate(async image => (await fetch((image as HTMLImageElement).src)).text())
  expect(svg).toContain(latest)
  await page.getByLabel('邮箱',{exact:true}).fill('test@example.com')
  await page.getByLabel('密码',{exact:true}).fill('wrong-password')
  await page.getByPlaceholder('验证码',{exact:true}).fill('ABCD')
  await page.getByRole('button',{name:'登录',exact:true}).click()
  await expect.poll(() => submitted).toBe(latest)
})
