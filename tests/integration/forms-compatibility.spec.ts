import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

test.afterAll(async () => { await db.$disconnect() })

test('admin add-user form refreshes after manual refresh and rejected registration', async ({ page }) => {
  const email = `phase1-form-${Date.now()}@example.com`
  const user = await makeUser(email)
  const permission = await db.permission.upsert({where:{code:'user:read'},create:{code:'user:read'},update:{}})
  const role = await db.role.create({data:{name:`phase1-form-${Date.now()}`,rolePermissions:{create:{permissionId:permission.id}},userRoles:{create:{userId:user.id}}}})
  try {
    const request = page.context().request
    const c = await getCaptcha(request, 'login')
    expect((await login(request, {email, password:testPassword, captchaId:c.id, captchaCode:c.code})).searchParams.has('error')).toBe(false)
    let issued = 0
    page.on('response', response => { if (response.url().includes('/api/captcha?purpose=register')) issued++ })
    await page.goto('/admin/users')
    await page.getByRole('button', {name:'添加用户'}).click()
    await page.getByRole('img', {name:'验证码'}).waitFor()
    await page.getByPlaceholder('验证码', {exact:true}).fill('ABCD')
    await page.getByRole('button', {name:'刷新验证码'}).click()
    await expect(page.getByPlaceholder('验证码', {exact:true})).toHaveValue('')
    await page.getByRole('img', {name:'验证码'}).waitFor()
    const before = issued
    await page.getByLabel('用户名', {exact:true}).fill('Form test')
    await page.getByLabel('邮箱', {exact:true}).fill(email)
    await page.getByLabel('密码', {exact:true}).fill(testPassword)
    await page.getByLabel('确认密码', {exact:true}).fill(testPassword)
    await page.getByPlaceholder('验证码', {exact:true}).fill('1111')
    await page.getByRole('button', {name:'注册',exact:true}).click()
    await expect.poll(() => issued).toBeGreaterThan(before)
    await expect(page.getByPlaceholder('验证码', {exact:true})).toHaveValue('')
    await expect(page.getByLabel('邮箱', {exact:true})).toHaveValue(email)
    await expect(page.getByLabel('密码', {exact:true})).toHaveValue(testPassword)
  } finally {
    await db.role.delete({where:{id:role.id}})
    await db.user.delete({where:{id:user.id}})
    await db.loginAttempt.deleteMany({where:{key:emailKey(email)}})
  }
})

test('comments accept both captcha field names and reject replay', async ({ request }) => {
  const user = await makeUser(`phase1-comment-${Date.now()}@example.com`)
  const post = await db.post.create({data:{title:'Auth compatibility test',slug:`phase1-comment-${Date.now()}`,content:'Test',status:'PUBLISHED',authorId:user.id}})
  try {
    for (const [index, field] of Array.from(['captchaCode', 'captcha'].entries())) {
      const c = await getCaptcha(request, 'comment')
      const data = {postId:post.id,nickname:'Reader',content:`Test comment ${index}`,captchaId:c.id,[field]:c.code}
      const response = await request.post('/api/comments',{data,headers:{'x-forwarded-for':`192.0.2.${index+1}`}})
      expect(response.status()).toBe(201)
      expect((await response.json()).code).toBe(2000)
      expect((await request.post('/api/comments',{data})).status()).toBe(400)
    }
    expect(await db.comment.count({where:{postId:post.id}})).toBe(2)
  } finally {
    await db.comment.deleteMany({where:{postId:post.id}})
    await db.post.delete({where:{id:post.id}})
    await db.user.delete({where:{id:user.id}})
  }
})
