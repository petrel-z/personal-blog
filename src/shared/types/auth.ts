export const CAPTCHA_PURPOSES = ['login', 'register', 'comment', 'password-reset'] as const
export type CaptchaPurpose = typeof CAPTCHA_PURPOSES[number]

export function isCaptchaPurpose(value: unknown): value is CaptchaPurpose {
  return typeof value === 'string' && CAPTCHA_PURPOSES.includes(value as CaptchaPurpose)
}
