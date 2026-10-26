export interface MailContent {
  subject: string
  text: string
  html: string
}

export interface MailMessage extends MailContent {
  to: string
}

export interface MailTransport {
  /** Resolves after the SMTP server accepts the message; inbox delivery is not guaranteed. */
  send(message: MailMessage): Promise<void>
}

const errorMessages = {
  MAIL_CONFIG_INVALID: '邮件服务配置缺失或无效',
  MAIL_MESSAGE_INVALID: '邮件内容或收件地址无效',
  MAIL_UNAVAILABLE: '邮件服务暂时不可用',
  MAIL_RECIPIENT_REJECTED: '邮件未被收件服务器接受',
} as const

/** Only these stable codes/messages cross the SMTP boundary; never retain the original error. */
export class MailError extends Error {
  constructor(public readonly code: keyof typeof errorMessages) {
    super(errorMessages[code])
    this.name = 'MailError'
  }
}
