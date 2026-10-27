const messages = {
  invalid: '邮箱或图片验证码格式无效',
  captcha: '图片验证码错误或已过期',
  limited: '申请过于频繁，请稍后重试',
  unavailable: '密码找回服务暂时不可用',
} as const

export class PasswordResetError extends Error {
  constructor(readonly reason: keyof typeof messages, readonly retryAfterSeconds = 0) {
    super(messages[reason])
    this.name = 'PasswordResetError'
  }
}
