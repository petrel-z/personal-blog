import { test, expect } from '@playwright/test'
import { db, getCaptcha, login, makeUser, testPassword } from './auth-fixtures'
import { runLoginAttempt } from '../../src/server/features/auth/login-attempt.service'
import { consumeQuota } from '../../src/server/features/auth/rate-limit.service'
import { emailKey } from '../../src/server/features/auth/identity'
import { prisma } from '../../src/server/db'

const attemptKeys: string[] = []
const quotaKeys: string[] = []
test.afterAll(async () => {
  await db.user.deleteMany({where:{email:{startsWith:'phase1-login-'}}})
  await db.loginAttempt.deleteMany({where:{key:{in:attemptKeys}}})
  await db.authRateBucket.deleteMany({where:{key:{in:quotaKeys}}})
  await db.$disconnect()
  await prisma.$disconnect()
})

test('parallel password attempts cannot bypass the lockout threshold', async () => {
  const key = emailKey(`phase1-concurrent-${Date.now()}`)
  attemptKeys.push(key)
  let verified = 0
  const result = await Promise.all(Array.from({length:8}, () => runLoginAttempt(key, async () => {verified++;return null})))
  expect(verified).toBe(5)
  expect(result.filter(r => r.kind === 'invalid')).toHaveLength(4)
  expect(result.filter(r => r.kind === 'locked')).toHaveLength(4)
  expect((await db.loginAttempt.findUniqueOrThrow({where:{key}})).failures).toBe(5)
})

test('parallel quota consumption allows only the configured number', async () => {
  const key = `phase1-quota-${Date.now()}`
  quotaKeys.push(key)
  const result = await Promise.all(Array.from({length:8}, () => consumeQuota(key,3,60)))
  expect(result.filter(r => r.allowed)).toHaveLength(3)
})

test('HTTP lockout persists, expires, and successful login clears failures', async ({ request }) => {
  const email = `phase1-login-lock-${Date.now()}@example.com`
  attemptKeys.push(emailKey(email))
  await makeUser(email)
  for(let i=0;i<5;i++) {
    const c=await getCaptcha(request,'login')
    const result=await login(request,{email,password:'incorrect',captchaId:c.id,captchaCode:c.code})
    expect(result.searchParams.get('code')).toBe(i===4?'locked_900':'credentials')
  }
  let c=await getCaptcha(request,'login')
  const blocked=await login(request,{email,password:testPassword,captchaId:c.id,captchaCode:c.code})
  expect(blocked.searchParams.get('code')).toMatch(/^locked_\d+$/)
  const key=emailKey(email)
  await db.loginAttempt.update({where:{key},data:{lockedUntil:new Date(Date.now()-1000)}})
  c=await getCaptcha(request,'login')
  const success=await login(request,{email,password:testPassword,captchaId:c.id,captchaCode:c.code})
  expect(success.searchParams.has('error')).toBe(false)
  expect((await db.loginAttempt.findUniqueOrThrow({where:{key}})).failures).toBe(0)
  const access=await request.get('/api/auth/access')
  expect(access.headers()['cache-control']).toBe('private, no-store')
  expect((await access.json()).data.destination).toBe('/forbidden')
})

test('authenticated users land only on currently authorized internal destinations', async ({ request }) => {
  const email=`phase1-login-reader-${Date.now()}@example.com`
  attemptKeys.push(emailKey(email))
  const user=await makeUser(email)
  const permission=await db.permission.upsert({where:{code:'post:read'},create:{code:'post:read'},update:{}})
  const role=await db.role.create({data:{name:`phase1-reader-${Date.now()}`,rolePermissions:{create:{permissionId:permission.id}},userRoles:{create:{userId:user.id}}}})
  try {
    const c=await getCaptcha(request,'login')
    expect((await login(request,{email,password:testPassword,captchaId:c.id,captchaCode:c.code})).searchParams.has('error')).toBe(false)
    expect((await (await request.get('/api/auth/access?callbackUrl=https://evil.example')).json()).data.destination).toBe('/admin/posts')
    await db.userRole.deleteMany({where:{userId:user.id}})
    expect((await (await request.get('/api/auth/access')).json()).data.destination).toBe('/forbidden')
  }finally{await db.role.delete({where:{id:role.id}})}
})


test('unknown email gets the same failure and lockout responses', async ({ request }) => {
  const email = `phase1-login-absent-${Date.now()}@example.com`
  const key = emailKey(email)
  attemptKeys.push(key)
  for (let i = 0; i < 5; i++) {
    const c = await getCaptcha(request, 'login')
    const result = await login(request, {email: email.toUpperCase(), password: testPassword, captchaId: c.id, captchaCode: c.code})
    expect(result.searchParams.get('code')).toBe(i === 4 ? 'locked_900' : 'credentials')
  }
  expect((await db.loginAttempt.findUniqueOrThrow({where:{key}})).failures).toBe(5)
  expect(await db.user.findUnique({where:{email}})).toBeNull()
})
