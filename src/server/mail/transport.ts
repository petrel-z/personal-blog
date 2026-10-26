import { isIP } from 'node:net'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { readMailConfig } from './config'
import { MailError, type MailTransport } from './types'

const messageSchema = z.object({
  to: z.string().trim().email().max(254),
  subject: z.string().min(1).max(200).refine(value => !/[\r\n]/.test(value)),
  text: z.string().min(1),
  html: z.string().min(1),
})

function createSmtpClient(config: ReturnType<typeof readMailConfig>) {
  try {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(!isIP(config.host) ? { servername: config.host } : {}) },
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      dnsTimeout: 10_000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  } catch {
    throw new MailError('MAIL_UNAVAILABLE')
  }
}

export function createMailTransport(env: Record<string, string | undefined> = process.env): MailTransport {
  const config = readMailConfig(env)
  const smtp = createSmtpClient(config)
  return {
    async send(message) {
      const parsed = messageSchema.safeParse(message)
      if (!parsed.success) throw new MailError('MAIL_MESSAGE_INVALID')
      try {
        // Only validated content and one recipient may cross this boundary; from is server-owned.
        const info = await smtp.sendMail({ from: config.from, ...parsed.data })
        if (info.rejected.length > 0) throw new MailError('MAIL_RECIPIENT_REJECTED')
        if (!info.accepted.some(address => address.toLowerCase() === parsed.data.to.toLowerCase())) {
          throw new MailError('MAIL_UNAVAILABLE')
        }
      } catch (error) {
        if (error instanceof MailError) throw error
        const failure = error as { code?: unknown; command?: unknown } | null
        // Only a recipient-specific refusal is distinct from transport/configuration outages.
        if (failure?.code === 'EENVELOPE' && failure.command === 'RCPT TO') {
          throw new MailError('MAIL_RECIPIENT_REJECTED')
        }
        throw new MailError('MAIL_UNAVAILABLE')
      }
    },
  }
}
