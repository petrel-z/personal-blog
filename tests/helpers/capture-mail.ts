import type { MailMessage, MailTransport } from '../../src/server/mail/types'

/** For injected service tests only. No network, disk, logs or shared global mailbox. */
export function createCaptureMailTransport(): MailTransport & { messages: MailMessage[] } {
  const messages: MailMessage[] = []
  return {
    messages,
    async send(message) { messages.push({ ...message }) },
  }
}
