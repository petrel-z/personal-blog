// Replace only the external SMTP boundary; configuration, validation and templates stay real.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }))

import nodemailer from 'nodemailer'
import { readMailConfig } from '@/server/mail/config'
import { createMailTransport } from '@/server/mail/transport'
import { buildResetCodeMail } from '@/server/mail/templates'
import { MailError } from '@/server/mail/types'
import { createCaptureMailTransport } from './helpers/capture-mail'

const env = {
  SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true',
  SMTP_USER: 'smtp-user', SMTP_PASSWORD: ' smtp-password-with-spaces ', MAIL_FROM: 'sender@example.com',
}
const message = () => ({ to: 'recipient@example.com', ...buildResetCodeMail('001234') })
const sendMail = jest.fn()
const verify = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  ;(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, verify })
  sendMail.mockResolvedValue({ accepted: ['recipient@example.com'], rejected: [] })
})

test('mail availability checks authenticate without sending a message and sanitize failures', async () => {
  verify.mockResolvedValue(true)
  await createMailTransport(env).verify()
  expect(verify).toHaveBeenCalledTimes(1)
  expect(sendMail).not.toHaveBeenCalled()
  verify.mockRejectedValue(new Error(`${env.SMTP_PASSWORD} rejected`))
  await expect(createMailTransport(env).verify()).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE', message: '邮件服务暂时不可用' })
})

test('reset_mail_contains_code_and_expiry', async () => {
  const content = buildResetCodeMail('001234')
  expect(content.subject).toBe('密码重置验证码')
  for (const body of [content.text, content.html]) {
    expect(body).toContain('001234')
    expect(body).toContain('10 分钟')
    expect(body).toContain('请勿')
  }
  expect(content.subject).not.toContain('001234')
  const capture = createCaptureMailTransport()
  const mail = { to: 'recipient@example.com', ...content }
  await capture.send(mail)
  mail.to = 'changed@example.com'
  expect(capture.messages).toEqual([{ to: 'recipient@example.com', ...content }])
  expect(createCaptureMailTransport().messages).toEqual([])
})

test.each(['12345', '1234567', '12345a', '１２３４５６', '<img/>', '123456\n'])('rejects invalid reset codes: %p', code => {
  expect(() => buildResetCodeMail(code)).toThrow('验证码必须为6位数字')
})

test.each(Object.keys(env))('missing %s rejects transport creation with a sanitized configuration error', key => {
  const config = { ...env, [key]: '' }
  let caught: unknown
  try { createMailTransport(config) } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(MailError)
  expect(caught).toMatchObject({ code: 'MAIL_CONFIG_INVALID' })
  expect(String(caught)).not.toContain(env.SMTP_PASSWORD)
  expect(String(caught)).not.toContain(env.SMTP_USER)
  expect(nodemailer.createTransport).not.toHaveBeenCalled()
})

test.each([
  { SMTP_PORT: '0' }, { SMTP_PORT: '65536' }, { SMTP_PORT: '587x' }, { SMTP_PORT: '587.5' },
  { SMTP_SECURE: 'yes' }, { SMTP_PORT: '465', SMTP_SECURE: 'false' }, { SMTP_PORT: '587', SMTP_SECURE: 'true' },
  { SMTP_HOST: 'smtp://smtp.example.com' }, { SMTP_HOST: 'smtp.example.com\r\nAUTH' },
  { MAIL_FROM: 'one@example.com,two@example.com' }, { MAIL_FROM: 'sender@example.com\r\nBcc: other@example.com' },
])('rejects invalid SMTP settings without contacting the server: %p', change => {
  expect(() => createMailTransport({ ...env, ...change })).toThrow(MailError)
  expect(nodemailer.createTransport).not.toHaveBeenCalled()
})

test('reads explicit settings while preserving password whitespace', () => {
  expect(readMailConfig(env)).toEqual({ host: 'smtp.example.com', port: 465, secure: true,
    user: 'smtp-user', password: env.SMTP_PASSWORD, from: 'sender@example.com' })
})

test.each([
  { SMTP_PORT: '465', SMTP_SECURE: 'true', secure: true, requireTLS: false },
  { SMTP_PORT: '587', SMTP_SECURE: 'false', secure: false, requireTLS: true },
])('enforces encrypted SMTP and certificate verification on port $SMTP_PORT', async settings => {
  await createMailTransport({ ...env, SMTP_PORT: settings.SMTP_PORT, SMTP_SECURE: settings.SMTP_SECURE }).send(message())
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: 'smtp.example.com', port: Number(settings.SMTP_PORT), secure: settings.secure, requireTLS: settings.requireTLS,
    tls: expect.objectContaining({ rejectUnauthorized: true, minVersion: 'TLSv1.2' }),
    auth: { user: 'smtp-user', pass: env.SMTP_PASSWORD }, logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  }))
  expect(sendMail).toHaveBeenCalledWith({ from: 'sender@example.com', ...message() })
})

test('message fields cannot override the configured sender or add hidden recipients', async () => {
  await createMailTransport(env).send({ ...message(), from: 'attacker@example.com', bcc: 'other@example.com' } as ReturnType<typeof message>)
  expect(sendMail).toHaveBeenCalledWith({ from: 'sender@example.com', ...message() })
})

test.each([
  { to: 'bad-address' }, { to: 'one@example.com,two@example.com' },
  { subject: 'Subject\r\nBcc: other@example.com' }, { text: { path: '/private-file' } },
  { html: { path: 'https://example.com/private' } },
])('invalid messages fail locally before SMTP: %p', change => {
  const mail = { ...message(), ...change } as ReturnType<typeof message>
  return expect(createMailTransport(env).send(mail)).rejects.toMatchObject({ code: 'MAIL_MESSAGE_INVALID' })
    .then(() => expect(sendMail).not.toHaveBeenCalled())
})

test('transport_failure_does_not_log_secrets', async () => {
  const secret = `${env.SMTP_USER} ${env.SMTP_PASSWORD} ${message().to} 001234`
  sendMail.mockRejectedValue(Object.assign(new Error(secret), { code: 'EAUTH', response: secret, command: 'AUTH PLAIN' }))
  const logs = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')]
  logs.forEach(log => log.mockImplementation(() => {}))
  try {
    let caught: unknown
    try { await createMailTransport(env).send(message()) } catch (error) { caught = error }
    expect(caught).toMatchObject({ code: 'MAIL_UNAVAILABLE', message: '邮件服务暂时不可用' })
    expect(caught).not.toHaveProperty('cause')
    expect(caught).not.toHaveProperty('response')
    const output = JSON.stringify([caught, String(caught), logs.map(log => log.mock.calls)])
    for (const value of [env.SMTP_USER, env.SMTP_PASSWORD, message().to, '001234']) expect(output).not.toContain(value)
  } finally { logs.forEach(log => log.mockRestore()) }
})

test('SMTP initialization failures are sanitized before crossing the adapter boundary', () => {
  ;(nodemailer.createTransport as jest.Mock).mockImplementation(() => {
    throw new Error(`Initialization failed for ${env.SMTP_USER}: ${env.SMTP_PASSWORD}`)
  })
  expect(() => createMailTransport(env)).toThrow(new MailError('MAIL_UNAVAILABLE'))
})

test('SMTP rejection is distinguishable from overall service failure without returning raw diagnostics', async () => {
  sendMail.mockRejectedValue(Object.assign(new Error('recipient@example.com refused'), { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 }))
  await expect(createMailTransport(env).send(message())).rejects.toMatchObject({ code: 'MAIL_RECIPIENT_REJECTED' })
  sendMail.mockResolvedValue({ accepted: [], rejected: ['recipient@example.com'] })
  await expect(createMailTransport(env).send(message())).rejects.toMatchObject({ code: 'MAIL_RECIPIENT_REJECTED' })
})

test('an unacknowledged recipient never counts as a successful send', async () => {
  sendMail.mockResolvedValue({ accepted: [], rejected: [] })
  await expect(createMailTransport(env).send(message())).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE' })
})
