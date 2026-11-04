'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Check } from 'lucide-react'
import { resetPasswordFormSchema, resetRequestFormSchema } from '@/shared/validations'
import { TencentCaptchaError, useTencentCaptcha } from '@/client/hooks/useTencentCaptcha'

const inputClass = 'w-full min-w-0'
const buttonClass = 'admin-btn admin-btn-primary auth-submit'
// Development must not restore a long cooldown saved under the production policy.
const sendCooldownStorageKey = process.env.NODE_ENV === 'development'
  ? 'password-reset:send-until:dev' : 'password-reset:send-until'

/** Store only an expiry timestamp; no mailbox, challenge or credential is persisted. */
function useCooldown(key: string) {
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const restore = () => {
      let value = 0
      try { value = Number(localStorage.getItem(key)) } catch {}
      const time = Date.now()
      setDeadline(Number.isSafeInteger(value) && value > time && value <= time + 86_400_000 ? value : 0)
      setNow(time)
      setReady(true)
    }
    restore()
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) restore() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])
  useEffect(() => {
    if (deadline <= now) return
    const timer = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(timer)
  }, [deadline, now])
  function start(seconds: number) {
    const time = Date.now()
    const value = time + Math.min(86_400, Math.max(1, seconds)) * 1000
    setNow(time)
    setDeadline(value)
    try { localStorage.setItem(key, String(value)) } catch {}
  }
  return { ready, seconds: Math.max(0, Math.ceil((deadline - now) / 1000)), start }
}

async function submitReset(path: 'request' | 'confirm', data: Record<string, string>) {
  const response = await fetch(`/api/auth/password-reset/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify(data), signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json()
  if (!body || typeof body.code !== 'number' || typeof body.message !== 'string') throw new Error('Invalid response')
  const retry = Number(body.data?.retryAfterSeconds ?? response.headers.get('Retry-After'))
  return {
    ok: response.ok && body.code === 2000,
    limited: response.status === 429,
    message: body.message,
    retryAfter: Number.isSafeInteger(retry) && retry > 0 ? retry : 60,
  }
}

export function PasswordResetForm() {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null)
  const [resending, setResending] = useState(false)
  const inFlight = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const sendingCooldown = useCooldown(sendCooldownStorageKey)
  const checkingCooldown = useCooldown('password-reset:confirm-until')

  const tencentCaptcha = useTencentCaptcha()

  useEffect(() => { if (step === 'confirm') codeInput.current?.focus() }, [step])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !sendingCooldown.ready || sendingCooldown.seconds > 0) return
    const parsed = resetRequestFormSchema.shape.email.safeParse(email)

    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    inFlight.current = true
    setBusy('send')
    setError('')
    try {
      const proof = await tencentCaptcha.openCaptcha()
      const result = await submitReset('request', { email: parsed.data, ticket: proof.ticket, randstr: proof.randstr })
      if (result.ok || result.limited) sendingCooldown.start(result.retryAfter)
      if (!result.ok) { setError(result.message); return }
      setEmail(parsed.data)
      setNotice(result.message)
      setCode('')
      setResending(false)
      setStep('confirm')
    } catch (error) { setError(error instanceof TencentCaptchaError ? error.message : '网络或服务异常，请稍后重试') }
    finally { inFlight.current = false; setBusy(null) }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !checkingCooldown.ready || checkingCooldown.seconds > 0) return
    const parsed = resetPasswordFormSchema.safeParse({ email, code, newPassword, confirmPassword })
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    inFlight.current = true
    setBusy('confirm')
    setError('')
    try {
      const result = await submitReset('confirm', { email: parsed.data.email, code: parsed.data.code, newPassword: parsed.data.newPassword })
      if (result.limited) checkingCooldown.start(result.retryAfter)
      if (!result.ok) { setError(result.message); return }
      setEmail('')
      setCode('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('密码重置成功，请使用新密码重新登录。')
      setStep('success')
    } catch { setError('网络或服务异常，请稍后重试') }
    finally { inFlight.current = false; setBusy(null) }
  }

  function useExistingCode() {
    const parsed = resetRequestFormSchema.shape.email.safeParse(email)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    setEmail(parsed.data)
    setError('')
    setNotice('请输入邮件中的 6 位验证码。')
    setStep('confirm')
  }

  return (
    <div className="auth-recovery">
      {step !== 'success' && <ol aria-label="找回密码步骤" className="auth-recovery-steps">
        <li aria-current={step === 'request' ? 'step' : undefined} className={step === 'request' ? 'text-primary font-medium' : 'text-muted-foreground'}>1. 获取验证码</li>
        <li aria-current={step === 'confirm' ? 'step' : undefined} className={step === 'confirm' ? 'text-primary font-medium' : 'text-muted-foreground'}>2. 设置新密码</li>
      </ol>}
      {error && <p role="alert" className="admin-notice admin-notice-error">{error}</p>}
      {step === 'success' && <div className="auth-recovery-success" aria-hidden="true"><Check size={30} /></div>}
      {notice && <p role="status" className="admin-notice">{notice}</p>}

      {step === 'request' && <form onSubmit={send} noValidate className="auth-form">
        <fieldset disabled={!!busy} className="auth-form min-w-0">
          <div className="admin-field">
            <label htmlFor="recovery-email" className="auth-recovery-label">注册邮箱</label>
            <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required
              value={email} onChange={event => setEmail(event.target.value)} placeholder="请输入注册时使用的邮箱" className={inputClass} />
          </div>
          <button type="submit" className={buttonClass} disabled={!!busy || !sendingCooldown.ready || sendingCooldown.seconds > 0}>
            {busy === 'send' ? '发送中…' : sendingCooldown.seconds > 0 ? `${sendingCooldown.seconds} 秒后可发送` : '发送邮件验证码'}
          </button>
          <button type="button" onClick={useExistingCode} className="admin-btn admin-btn-ghost auth-recovery-existing">已有邮件验证码</button>
        </fieldset>
      </form>}

      {step === 'confirm' && <>
        <p className="text-sm text-muted-foreground break-all">找回邮箱：{email}</p>
        <form onSubmit={confirm} noValidate className="auth-form">
          <fieldset disabled={!!busy} className="auth-form min-w-0">
            <div className="admin-field">
              <label htmlFor="recovery-code" className="auth-recovery-label">邮件验证码</label>
              <input ref={codeInput} id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                value={code} onChange={event => setCode(event.target.value)} placeholder="输入 6 位数字验证码" className={inputClass} aria-describedby="recovery-code-hint" />
              <p id="recovery-code-hint" className="text-xs text-muted-foreground">验证码 10 分钟内有效。重发后请使用最新邮件中的验证码。</p>
            </div>
            <div className="admin-field">
              <label htmlFor="recovery-password" className="auth-recovery-label">新密码</label>
              <div className="auth-password">
                <input id="recovery-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={newPassword}
                  onChange={event => setNewPassword(event.target.value)} placeholder="至少 6 位，最多 72 字节" className={inputClass} />
                <button type="button" className="auth-password-toggle" aria-label={showPassword ? '隐藏新密码' : '显示新密码'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="admin-field">
              <label htmlFor="recovery-confirm" className="auth-recovery-label">确认新密码</label>
              <div className="auth-password">
                <input id="recovery-confirm" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" className={inputClass} />
                <button type="button" className="auth-password-toggle" aria-label={showConfirmation ? '隐藏确认新密码' : '显示确认新密码'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}>
                  {showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button type="submit" className={buttonClass} disabled={!!busy || !checkingCooldown.ready || checkingCooldown.seconds > 0}>
              {busy === 'confirm' ? '重置中…' : checkingCooldown.seconds > 0 ? `${checkingCooldown.seconds} 秒后可重试` : '重置密码'}
            </button>
          </fieldset>
        </form>
        <div className="auth-recovery-resend">
          <div className="auth-recovery-actions">
            <button type="button" disabled={!!busy || sendingCooldown.seconds > 0 || !sendingCooldown.ready}
              onClick={() => { setError(''); setResending(true) }} className="admin-btn admin-btn-ghost">
              {sendingCooldown.seconds > 0 ? `${sendingCooldown.seconds} 秒后可重发` : '重新发送'}
            </button>
            <button type="button" disabled={!!busy} className="admin-btn admin-btn-ghost"
              onClick={() => { setStep('request'); setError(''); setNotice(''); setCode(''); setNewPassword(''); setConfirmPassword(''); setResending(false) }}>更换邮箱</button>
          </div>
          {resending && <form onSubmit={send} noValidate className="auth-form">
            <fieldset disabled={!!busy} className="auth-form min-w-0">
              <p className="text-sm text-muted-foreground">重新发送需要再次完成人机验证。</p>
              <button type="submit" disabled={!!busy || sendingCooldown.seconds > 0} className={buttonClass}>
                {busy === 'send' ? '发送中…' : '发送新验证码'}
              </button>
            </fieldset>
          </form>}
        </div>
      </>}

      <p className="auth-switch"><Link href="/login" className={step === 'success' ? 'admin-btn admin-btn-primary auth-recovery-return' : undefined}>返回登录</Link></p>
    </div>
  )
}
