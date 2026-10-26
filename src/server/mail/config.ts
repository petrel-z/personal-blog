import { isIP } from 'node:net'
import { z } from 'zod'
import { MailError } from './types'

const configSchema = z.object({
  SMTP_HOST: z.string().trim().min(1).max(253).refine(host => isIP(host) !== 0 ||
    host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).refine(port => port >= 1 && port <= 65535),
  SMTP_SECURE: z.enum(['true', 'false']).transform(value => value === 'true'),
  SMTP_USER: z.string().trim().min(1),
  SMTP_PASSWORD: z.string().min(1), // Whitespace can be part of an SMTP password.
  MAIL_FROM: z.string().trim().email().max(254),
}).refine(config => !(config.SMTP_PORT === 465 && !config.SMTP_SECURE) &&
  !(config.SMTP_PORT === 587 && config.SMTP_SECURE))

export function readMailConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) throw new MailError('MAIL_CONFIG_INVALID')
  const config = parsed.data
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
    from: config.MAIL_FROM,
  }
}
