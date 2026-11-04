import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import http from 'node:http'
import net, { type Socket } from 'node:net'
import { startCaptureSmtp } from './helpers/capture-smtp'

const execute = promisify(execFile)
// A child allows Node to load the test CA at startup without changing this process's TLS policy.
async function send(port: number, secure: boolean, trust: boolean, proxy = '') {
  const { stdout, stderr } = await execute(process.execPath, ['--import', 'tsx', '-e', `
    const { createMailTransport } = require('./src/server/mail/transport.ts');
    const { buildResetCodeMail } = require('./src/server/mail/templates.ts');
    (async () => {
      try {
        const transport = createMailTransport();
        await transport.verify();
        await transport.send({to:'recipient@example.com', ...buildResetCodeMail('001234')});
        console.log(JSON.stringify({ok:true}));
      } catch (error) {
        console.log(JSON.stringify({ok:false, code:error.code, message:error.message}));
      }
    })();
  `], { timeout: 20_000, env: {
    ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: String(secure),
    SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com',
    SMTP_PROXY: proxy,
    NODE_EXTRA_CA_CERTS: trust ? resolve('tests/fixtures/smtp/localhost-cert.pem') : '',
  } })
  expect(stderr).not.toContain('test-password')
  expect(stderr).not.toContain('001234')
  return JSON.parse(stdout)
}

test.each(['tls', 'starttls'] as const)('SMTP verification and mail both use the configured HTTP proxy with %s', async mode => {
  const smtp = await startCaptureSmtp(mode)
  const sockets = new Set<Socket>()
  const targets: string[] = []
  const proxy = http.createServer()
  function track(socket: Socket) {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
  }
  proxy.on('connection', track)
  proxy.on('connect', (request, client, head) => {
    targets.push(request.url ?? '')
    const upstream = net.connect({ host: '127.0.0.1', port: smtp.port }, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      client.pipe(upstream)
      upstream.pipe(client)
    })
    track(upstream)
    upstream.on('error', () => client.destroy())
    client.on('close', () => upstream.destroy())
    upstream.on('close', () => client.destroy())
  })
  try {
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve))
    const port = (proxy.address() as net.AddressInfo).port
    expect(await send(smtp.port, mode === 'tls', true, `http://127.0.0.1:${port}`)).toEqual({ ok: true })
    expect(targets).toEqual([`127.0.0.1:${smtp.port}`, `127.0.0.1:${smtp.port}`])
    expect(smtp.commands.filter(command => command === 'AUTH')).toHaveLength(2)
    expect(smtp.messages).toHaveLength(1)
  } finally {
    sockets.forEach(socket => socket.destroy())
    await new Promise<void>(resolve => proxy.close(() => resolve()))
    await smtp.close()
  }
}, 25_000)

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
