import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { emailKey } from '../../src/server/features/auth/identity'

test.afterAll(async () => { await db.$disconnect() })

test('user readers cannot open account creation even with an accidental user:create grant', async ({ page }) => {
  const email = `phase1-form-${Date.now()}@example.com`
  const user = await makeUser(email)
  const grants = await Promise.all(['user:read', 'user:create'].map(code => db.permission.upsert({where:{code},create:{code},update:{}})))
  const role = await db.role.create({data:{name:`phase1-form-${Date.now()}`,rolePermissions:{create:grants.map(permission=>({permissionId:permission.id}))},userRoles:{create:{userId:user.id}}}})
  try {
    const request = page.context().request
    const c = await getCaptcha(request, 'login')
    expect((await login(request, {email, password:testPassword, captchaId:c.id, captchaCode:c.code})).searchParams.has('error')).toBe(false)
    let issued = 0
    page.on('request', request => { if (request.url().includes('/api/captcha?purpose=register')) issued++ })
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', {name:'用户管理',exact:true})).toBeVisible()
    await expect(page.getByRole('button', {name:'添加用户',exact:true})).toHaveCount(0)
    expect((await request.post('/api/auth/users', {data:'{'})).status()).toBe(403)
    expect(issued).toBe(0)
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
