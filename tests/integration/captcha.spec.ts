import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'

test.afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: 'phase1-captcha-' } } })
  await db.$disconnect()
})

test('correct credentials without captcha cannot establish a session', async ({ request }) => {
  const email = `phase1-captcha-${Date.now()}@example.com`
  await makeUser(email)
  const result = await login(request, { email, password: testPassword })
  expect(result.searchParams.get('code')).toBe('captcha')
  expect(await (await request.get('/api/auth/session')).json()).toBeNull()
})

test('captcha issuance rejects unrecognized purposes', async ({ request }) => {
  expect((await request.get('/api/captcha?purpose=anything')).status()).toBe(400)
})

test('the compatibility verifier cannot consume login captchas', async ({ request }) => {
  const captcha = await getCaptcha(request, 'login')
  const response = await request.post('/api/captcha', {data:{captchaId:captcha.id,code:captcha.code}})
  expect(response.status()).toBe(400)
})

test('registration requires captcha before creating any account', async ({ request }) => {
  const email = `phase1-captcha-register-${Date.now()}@example.com`
  const response = await request.post('/api/auth/register', {data:{name:'Test',email,password:testPassword}})
  expect(response.status()).toBe(400)
  expect(await db.user.findUnique({where:{email}})).toBeNull()
})

test('expired and incorrectly answered captchas cannot be reused', async ({ request }) => {
  const expired = await getCaptcha(request, 'comment')
  await db.captchaChallenge.update({where:{id:expired.id},data:{expiresAt:new Date(0)}})
  expect((await request.post('/api/captcha', {data:{captchaId:expired.id,code:expired.code}})).status()).toBe(400)
  const wrong = await getCaptcha(request, 'comment')
  expect((await request.post('/api/captcha', {data:{captchaId:wrong.id,code:'1111'}})).status()).toBe(400)
  expect((await request.post('/api/captcha', {data:{captchaId:wrong.id,code:wrong.code}})).status()).toBe(400)
})

test('concurrent captcha consumption has exactly one winner and accepts lowercase', async ({ request }) => {
  const captcha = await getCaptcha(request, 'comment')
  const responses = await Promise.all([1,2].map(() => request.post('/api/captcha', {data:{captchaId:captcha.id,code:captcha.code.toLowerCase()}})))
  expect(responses.map(r => r.status()).sort()).toEqual([200,400])
})

test('registration with a valid purpose-bound captcha produces a member', async ({ request }) => {
  const captcha = await getCaptcha(request, 'register')
  const email = `phase1-captcha-member-${Date.now()}@example.com`
  const response = await request.post('/api/auth/register', {data:{name:'Test',email,password:testPassword,captchaId:captcha.id,captchaCode:captcha.code}})
  expect(response.status()).toBe(201)
  const user = await db.user.findUniqueOrThrow({where:{email},include:{userRoles:{include:{role:true}}}})
  expect(user.userRoles.map(r => r.role.name)).toEqual(['member'])
})
