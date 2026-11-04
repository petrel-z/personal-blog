jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn(), passwordResetChallenge: { updateMany: jest.fn() } } }))
jest.mock('tencentcloud-sdk-nodejs-captcha', () => ({ captcha: { v20190722: { Client: jest.fn(() => ({ DescribeCaptchaResult: describeCaptcha })) } } }))
jest.mock('@/server/features/auth/rate-limit.service', () => ({ consumeQuota: jest.fn() }))
jest.mock('node:crypto', () => ({ ...jest.requireActual('node:crypto'), randomInt: jest.fn() }))

import { createHmac, randomInt } from 'node:crypto'
import { prisma } from '@/server/db'
import { captcha } from 'tencentcloud-sdk-nodejs-captcha'
import { consumeQuota } from '@/server/features/auth/rate-limit.service'
import { generateResetCode, hashResetCode, readResetCodeSecret } from '@/server/features/auth/password-reset-code'
import { requestPasswordReset } from '@/server/features/auth/password-reset.service'
import { POST } from '@/app/api/auth/password-reset/request/route'
import { createCaptureMailTransport } from './helpers/capture-mail'

const describeCaptcha = jest.fn()
const originalEnv = { ...process.env }
const configured = { AUTH_CODE_SECRET: 'test-only-reset-secret-with-32-bytes-minimum',
  TENCENT_SECRET_ID: 'test-id', TENCENT_SECRET_KEY: 'test-key', NEXT_PUBLIC_CAPTCHA_APP_ID: '123456', APP_SCRECT_KEY: 'test-app-key' }
const secret = 'test-only-reset-secret-with-32-bytes-minimum'
const input = { email: 'user@example.com', ticket: 'test-ticket', randstr: 'test-random', ip: '192.0.2.1' }
beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(process.env, configured)
  describeCaptcha.mockReset().mockResolvedValue({ CaptchaCode: 1 })
  ;(consumeQuota as jest.Mock).mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  ;(prisma.$transaction as jest.Mock).mockReset()
})
afterAll(() => {
  for (const key of Object.keys(configured)) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

test.each([[0, '000000'], [7, '000007'], [999999, '999999']])('secure random value %i becomes six digits including leading zeros', (value, code) => {
  ;(randomInt as jest.Mock).mockReturnValue(value)
  expect(generateResetCode()).toBe(code)
  expect(randomInt).toHaveBeenCalledWith(1_000_000)
})

test('code digest binds purpose, email, challenge and dedicated secret', () => {
  const actual = hashResetCode('email-key', 'challenge-id', '000007', secret)
  expect(actual).toBe(createHmac('sha256', secret).update(['password-reset', 'email-key', 'challenge-id', '000007'].join('\0')).digest('hex'))
  expect(actual).toMatch(/^[a-f0-9]{64}$/)
  for (const args of [['another-email', 'challenge-id', '000007', secret], ['email-key', 'another-challenge', '000007', secret],
    ['email-key', 'challenge-id', '000008', secret], ['email-key', 'challenge-id', '000007', secret + '!']]) {
    expect(hashResetCode(args[0], args[1], args[2], args[3])).not.toBe(actual)
  }
})

test.each(['', 'too-short'])('missing or weak dedicated secret fails without falling back to AUTH_SECRET', value => {
  process.env.AUTH_CODE_SECRET = value
  expect(() => readResetCodeSecret()).toThrow('密码找回服务暂时不可用')
})

test.each([{ email: 'invalid' }, { ticket: '' }, { randstr: '' }, { ticket: undefined },
  { randstr: undefined }, { ticket: 123 }, { ticket: 'x'.repeat(4097) }])('invalid input cannot verify captcha, query accounts or send mail: case %#', async change => {
  const mail = createCaptureMailTransport()
  await expect(requestPasswordReset({ ...input, ...change }, { mail })).rejects.toMatchObject({ reason: 'invalid' })
  expect(describeCaptcha).not.toHaveBeenCalled()
  expect(consumeQuota).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(mail.messages).toEqual([])
})

test.each([7, 8, 9, 21, undefined])('Tencent rejection %s cannot consume send quota or contact SMTP', async CaptchaCode => {
  describeCaptcha.mockResolvedValue({ CaptchaCode })
  const mail = { ...createCaptureMailTransport(), verify: jest.fn() }
  await expect(requestPasswordReset(input, { mail })).rejects.toMatchObject({ reason: 'captcha' })
  expect(consumeQuota).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(mail.verify).not.toHaveBeenCalled()
})

test('a Tencent outage fails closed without leaking its diagnostics', async () => {
  describeCaptcha.mockRejectedValue(new Error('private cloud diagnostic'))
  await expect(requestPasswordReset(input, { mail: createCaptureMailTransport() }))
    .rejects.toMatchObject({ reason: 'unavailable', message: '密码找回服务暂时不可用' })
  expect(consumeQuota).not.toHaveBeenCalled()
})

test.each(['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'NEXT_PUBLIC_CAPTCHA_APP_ID', 'APP_SCRECT_KEY'])('missing %s prevents a cloud request', async key => {
  process.env[key] = ''
  await expect(requestPasswordReset(input, { mail: createCaptureMailTransport() })).rejects.toMatchObject({ reason: 'unavailable' })
  expect(describeCaptcha).not.toHaveBeenCalled()
})

test('Tencent is verified in the mail request using the submitted ticket and normalized source IP', async () => {
  ;(consumeQuota as jest.Mock).mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
  await expect(requestPasswordReset({ ...input, ip: '::1' }, { mail: createCaptureMailTransport() }))
    .rejects.toMatchObject({ reason: 'limited', retryAfterSeconds: 60 })
  expect(describeCaptcha).toHaveBeenCalledWith({ Ticket: 'test-ticket', Randstr: 'test-random', UserIp: '127.0.0.1',
    CaptchaType: 9, CaptchaAppId: 123456, AppSecretKey: 'test-app-key' })
  expect(captcha.v20190722.Client).toHaveBeenCalledWith(expect.objectContaining({
    profile: { httpProfile: { reqTimeout: 10 } },
  }))
})

test('an unusable scoped IPv6 source fails closed before contacting Tencent', async () => {
  await expect(requestPasswordReset({ ...input, ip: 'fe80::1%en0' }, { mail: createCaptureMailTransport() }))
    .rejects.toMatchObject({ reason: 'unavailable' })
  expect(describeCaptcha).not.toHaveBeenCalled()
})

test('a verified request sends the code and preserves the resend response', async () => {
  const mail = createCaptureMailTransport()
  const tx = { $executeRaw: jest.fn(), $queryRaw: jest.fn().mockResolvedValue([{ sentAt: new Date(0) }]),
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'user', email: input.email }) },
    passwordResetChallenge: { update: jest.fn() } }
  ;(prisma.$transaction as jest.Mock).mockImplementation(async run => run(tx))
  ;(randomInt as jest.Mock).mockReturnValue(7)
  expect(await requestPasswordReset(input, { mail })).toEqual({ message: '如果该邮箱已注册，你将收到验证码', retryAfterSeconds: 60 })
  expect(mail.messages).toHaveLength(1)
  expect(mail.messages[0]).toMatchObject({ to: input.email })
  expect(mail.messages[0].text).toContain('000007')
})

test.each([
  ['development', 2], ['production', 57],
] as const)('%s applies its own resend interval to a request sent three seconds ago', async (mode, retryAfterSeconds) => {
  const env = jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: mode })
  jest.useFakeTimers().setSystemTime(new Date('2026-11-04T02:00:00Z'))
  const mail = createCaptureMailTransport()
  const tx = { $executeRaw: jest.fn(), $queryRaw: jest.fn().mockResolvedValue([{ sentAt: new Date(Date.now() - 3000) }]) }
  ;(prisma.$transaction as jest.Mock).mockImplementation(async run => run(tx))
  try {
    await expect(requestPasswordReset(input, { mail })).rejects.toMatchObject({ reason: 'limited', retryAfterSeconds })
    expect(mail.messages).toEqual([])
  } finally { jest.useRealTimers(); env.restore() }
})

test('a successful captcha code with a malicious risk result still cannot send mail', async () => {
  describeCaptcha.mockResolvedValue({ CaptchaCode: 1, EvilLevel: 100 })
  const mail = createCaptureMailTransport()
  await expect(requestPasswordReset(input, { mail })).rejects.toMatchObject({ reason: 'captcha' })
  expect(consumeQuota).not.toHaveBeenCalled()
  expect(mail.messages).toEqual([])
})

test('HTTP requires a ticket even if the caller claims verification already succeeded', async () => {
  const response = await POST(new Request('http://localhost/api/auth/password-reset/request', {
    method: 'POST', body: JSON.stringify({ email: input.email, verified: true, captchaId: 'old', captchaCode: 'ABCD' }),
  }))
  expect(response.status).toBe(400)
  expect(describeCaptcha).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test('HTTP binds Tencent verification and rate limiting to the request IP, ignoring body IP', async () => {
  ;(consumeQuota as jest.Mock).mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
  const response = await POST(new Request('http://localhost/api/auth/password-reset/request', {
    method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.99, 192.0.2.100' }, body: JSON.stringify(input),
  }))
  expect(response.status).toBe(429)
  expect(response.headers.get('retry-after')).toBe('60')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(describeCaptcha).toHaveBeenCalledWith(expect.objectContaining({ UserIp: '192.0.2.99' }))
  expect(await response.json()).toMatchObject({ data: { retryAfterSeconds: 60 } })
})
