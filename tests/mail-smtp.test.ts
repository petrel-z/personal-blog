import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { startCaptureSmtp } from './helpers/capture-smtp'

const execute = promisify(execFile)
// A child allows Node to load the test CA at startup without changing this process's TLS policy.
async function send(port: number, secure: boolean, trust: boolean) {
  const { stdout, stderr } = await execute(process.execPath, ['--import', 'tsx', '-e', `
    const { createMailTransport } = require('./src/server/mail/transport.ts');
    const { buildResetCodeMail } = require('./src/server/mail/templates.ts');
    (async () => {
      try {
        await createMailTransport().send({to:'recipient@example.com', ...buildResetCodeMail('001234')});
        console.log(JSON.stringify({ok:true}));
      } catch (error) {
        console.log(JSON.stringify({ok:false, code:error.code, message:error.message}));
      }
    })();
  `], { timeout: 20_000, env: {
    ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: String(secure),
    SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com',
    NODE_EXTRA_CA_CERTS: trust ? resolve('tests/fixtures/smtp/localhost-cert.pem') : '',
  } })
  expect(stderr).not.toContain('test-password')
  expect(stderr).not.toContain('001234')
  return JSON.parse(stdout)
}

test.each(['tls', 'starttls'] as const)('real SMTP sends through %s with a trusted certificate', async mode => {
  const server = await startCaptureSmtp(mode)
  try {
    expect(await send(server.port, mode === 'tls', true)).toEqual({ ok: true })
    expect(server.messages).toHaveLength(1)
    expect(server.messages[0]).toContain('From: sender@example.com')
    expect(server.messages[0]).toContain('To: recipient@example.com')
    expect(server.messages[0]).toContain('multipart/alternative')
    expect(server.messages[0]).toContain('001234')
    expect(server.commands).toContain('AUTH')
    if (mode === 'starttls') expect(server.commands.indexOf('STARTTLS')).toBeLessThan(server.commands.indexOf('AUTH'))
  } finally { await server.close() }
}, 25_000)

test('a server without STARTTLS cannot receive credentials or a reset code', async () => {
  const server = await startCaptureSmtp('plaintext')
  try {
    expect(await send(server.port, false, true)).toMatchObject({ ok: false, code: 'MAIL_UNAVAILABLE' })
    expect(server.commands).not.toContain('AUTH')
    expect(server.messages).toEqual([])
  } finally { await server.close() }
}, 25_000)

test.each(['tls', 'starttls'] as const)('untrusted certificates are rejected for %s before authentication', async mode => {
  const server = await startCaptureSmtp(mode)
  try {
    expect(await send(server.port, mode === 'tls', false)).toMatchObject({ ok: false, code: 'MAIL_UNAVAILABLE' })
    expect(server.commands).not.toContain('AUTH')
    expect(server.messages).toEqual([])
  } finally { await server.close() }
}, 25_000)
