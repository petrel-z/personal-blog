import { isIP } from 'node:net'
import { captcha } from 'tencentcloud-sdk-nodejs-captcha'
import { z } from 'zod'
import { PasswordResetError } from './password-reset-error'

export const tencentChallengeSchema = z.object({
  ticket: z.string().trim().min(1).max(4096),
  randstr: z.string().trim().min(1).max(1024),
})

export type TencentChallenge = z.infer<typeof tencentChallengeSchema> & { ip: string }

/** Consume the one-use cloud ticket in the same request that sends the email. */
export async function verifyTencentCaptcha(input: TencentChallenge): Promise<void> {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  const appSecret = process.env.APP_SCRECT_KEY
  const appId = Number(process.env.NEXT_PUBLIC_CAPTCHA_APP_ID)
  if (!secretId || !secretKey || !appSecret || !Number.isSafeInteger(appId) || appId <= 0 ||
      !isIP(input.ip) || input.ip.includes('%')) throw new PasswordResetError('unavailable')
  let response
  try {
    const client = new captcha.v20190722.Client({
      credential: { secretId, secretKey }, region: 'ap-guangzhou',
      profile: { httpProfile: { reqTimeout: 10 } },
    })
    response = await client.DescribeCaptchaResult({
      Ticket: input.ticket, Randstr: input.randstr, UserIp: input.ip === '::1' ? '127.0.0.1' : input.ip,
      CaptchaType: 9, CaptchaAppId: appId, AppSecretKey: appSecret,
    })
  } catch { throw new PasswordResetError('unavailable') }
  if (response.CaptchaCode !== 1 || response.EvilLevel === 100) throw new PasswordResetError('captcha')
}
