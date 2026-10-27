import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { startCaptureSmtp } from './capture-smtp'

/** Test-only server; no mailbox preview endpoint or external mail delivery. */
export async function startRecoveryApp() {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(3018, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()))
  })
  const smtp = await startCaptureSmtp('tls')
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3018'], {
    detached: true, stdio: 'ignore', env: {
      ...process.env, AUTH_URL: 'http://127.0.0.1:3018',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_SECURE: 'true',
      SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com',
      NODE_EXTRA_CA_CERTS: resolve('tests/fixtures/smtp/localhost-cert.pem'),
    },
  })
  let spawnError = false
  child.on('error', () => { spawnError = true })
  async function close() {
    if (child.pid && child.exitCode === null) {
      const exited = once(child, 'exit')
      try { process.kill(-child.pid, 'SIGTERM') } catch {}
      await Promise.race([exited, delay(3000)])
      if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
    }
    await smtp.close()
  }
  try {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null) throw new Error('Recovery test server could not start')
      try {
        const response = await fetch('http://127.0.0.1:3018/login', { signal: AbortSignal.timeout(2000) })
        if (response.ok) return { smtp, close }
      } catch {}
      await delay(250)
    }
    throw new Error('Recovery test server readiness timeout')
  } catch (error) { await close(); throw error }
}

export function capturedResetCode(message: string) {
  const part = /Content-Type: text\/plain[^\r\n]*\r\n([\s\S]*?)\r\n\r\n([\s\S]*?)(?=\r\n--)/i.exec(message)
  if (!part) throw new Error('Captured message has no text part')
  const text = /Content-Transfer-Encoding: base64/i.test(part[1])
    ? Buffer.from(part[2].replace(/\s/g, ''), 'base64').toString('utf8')
    : Buffer.from(part[2].replace(/=\r?\n/g, '').replace(/=([A-F0-9]{2})/g,
      (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8')
  const match = /验证码：(\d{6})/.exec(text)
  if (!match) throw new Error('Captured message has no reset code')
  return match[1]
}
