const messages = {
  invalid: '邮箱或人机验证参数无效',
  captcha: '人机验证失败或已过期，请重新验证',
  limited: '申请过于频繁，请稍后重试',
  unavailable: '密码找回服务暂时不可用',
  invalid_confirmation: '邮箱、邮件验证码或新密码格式无效',
  code: '邮件验证码错误或已失效，请重新获取',
  verification_limited: '验证过于频繁，请稍后重试',
} as const

export class PasswordResetError extends Error {
  constructor(readonly reason: keyof typeof messages, readonly retryAfterSeconds = 0) {
    super(messages[reason])
    this.name = 'PasswordResetError'
  }
}
