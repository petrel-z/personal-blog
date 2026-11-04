import { randomUUID } from 'node:crypto'
import type { TencentChallenge } from '../../src/server/features/auth/tencent-captcha.service'
import { PasswordResetError } from '../../src/server/features/auth/password-reset-error'

/** Cloud boundary double; database, quotas, SMTP and password changes stay real. */
export function createTencentVerifier() {
  const tickets = new Map<string, { randstr: string; accepted: boolean }>()
  return {
    issue(accepted = true) {
      const proof = { ticket: randomUUID(), randstr: randomUUID() }
      tickets.set(proof.ticket, { randstr: proof.randstr, accepted })
      return proof
    },
    async verify(input: TencentChallenge) {
      const proof = tickets.get(input.ticket)
      tickets.delete(input.ticket)
      if (!proof?.accepted || proof.randstr !== input.randstr) throw new PasswordResetError('captcha')
    },
  }
}
