jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn(), passwordResetChallenge: { updateMany: jest.fn() } } }))
jest.mock('@/server/features/auth/captcha.service', () => ({ consumeCaptcha: jest.fn() }))
jest.mock('@/server/features/auth/rate-limit.service', () => ({ consumeQuota: jest.fn() }))
jest.mock('node:crypto', () => ({ ...jest.requireActual('node:crypto'), randomInt: jest.fn() }))

import { createHmac, randomInt } from 'node:crypto'
import { prisma } from '@/server/db'
import { consumeCaptcha } from '@/server/features/auth/captcha.service'
import { consumeQuota } from '@/server/features/auth/rate-limit.service'
import { generateResetCode, hashResetCode, readResetCodeSecret } from '@/server/features/auth/password-reset-code'
import { requestPasswordReset } from '@/server/features/auth/password-reset.service'
import { createCaptureMailTransport } from './helpers/capture-mail'

const originalSecret = process.env.AUTH_CODE_SECRET
const secret = 'test-only-reset-secret-with-32-bytes-minimum'
const input = { email: 'user@example.com', captchaId: 'challenge', captchaCode: 'ABCD', ip: '192.0.2.1' }
beforeEach(() => { jest.clearAllMocks(); process.env.AUTH_CODE_SECRET = secret })
afterAll(() => {
  if (originalSecret === undefined) delete process.env.AUTH_CODE_SECRET
  else process.env.AUTH_CODE_SECRET = originalSecret
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

test.each([{ email: 'invalid' }, { captchaId: '' }, { captchaCode: '12345' }])('invalid input cannot query accounts or send mail: %p', async change => {
  const mail = createCaptureMailTransport()
  await expect(requestPasswordReset({ ...input, ...change }, { mail })).rejects.toMatchObject({ reason: 'invalid' })
  expect(consumeCaptcha).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(mail.messages).toEqual([])
})

test('incorrect image captcha cannot query accounts, consume send quota or contact SMTP', async () => {
  ;(consumeCaptcha as jest.Mock).mockResolvedValue(false)
  const mail = { ...createCaptureMailTransport(), verify: jest.fn() }
  await expect(requestPasswordReset(input, { mail })).rejects.toMatchObject({ reason: 'captcha' })
  expect(consumeCaptcha).toHaveBeenCalledWith({ id: 'challenge', code: 'ABCD', purpose: 'password-reset' })
  expect(consumeQuota).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(mail.verify).not.toHaveBeenCalled()
})

test('an unusable scoped IPv6 source cannot crash input validation before captcha validation', async () => {
  ;(consumeCaptcha as jest.Mock).mockResolvedValue(false)
  await expect(requestPasswordReset({ ...input, ip: 'fe80::1%en0' }, { mail: createCaptureMailTransport() }))
    .rejects.toMatchObject({ reason: 'captcha' })
})
