'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useCaptcha } from '@/client/hooks/useCaptcha'
import { CaptchaInput } from '@/app/(admin)/_components/CaptchaInput'
import { resetPasswordFormSchema, resetRequestFormSchema } from '@/shared/validations'

const inputClass = 'w-full min-w-0 px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50'
const buttonClass = 'w-full py-2 px-3 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'

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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null)
  const [resending, setResending] = useState(false)
  const inFlight = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const captcha = useCaptcha('password-reset')
  const sendingCooldown = useCooldown('password-reset:send-until')
  const checkingCooldown = useCooldown('password-reset:confirm-until')

  useEffect(() => { if (step === 'confirm') codeInput.current?.focus() }, [step])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !sendingCooldown.ready || sendingCooldown.seconds > 0) return
    const parsed = resetRequestFormSchema.safeParse({ email, captcha: captcha.value })
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    if (!captcha.id || captcha.loading) { setError('请刷新图片验证码后重试'); return }
    inFlight.current = true
    setBusy('send')
    setError('')
    try {
      const result = await submitReset('request', { email: parsed.data.email, captchaId: captcha.id, captchaCode: parsed.data.captcha })
      if (result.ok || result.limited) sendingCooldown.start(result.retryAfter)
      if (!result.ok) { setError(result.message); return }
      setEmail(parsed.data.email)
      setNotice(result.message)
      setCode('')
      setResending(false)
      setStep('confirm')
    } catch { setError('网络或服务异常，请稍后重试') }
    finally {
      await captcha.refresh()
      inFlight.current = false
      setBusy(null)
    }
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
    <div className="space-y-4">
      {step !== 'success' && <ol aria-label="找回密码步骤" className="flex justify-center gap-5 text-sm">
        <li aria-current={step === 'request' ? 'step' : undefined} className={step === 'request' ? 'text-primary font-medium' : 'text-muted-foreground'}>1. 获取验证码</li>
        <li aria-current={step === 'confirm' ? 'step' : undefined} className={step === 'confirm' ? 'text-primary font-medium' : 'text-muted-foreground'}>2. 设置新密码</li>
      </ol>}
      {error && <p role="alert" className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</p>}
      {notice && <p role="status" className="p-3 text-sm bg-primary/5 border rounded-lg">{notice}</p>}

      {step === 'request' && <form onSubmit={send} noValidate className="space-y-4">
        <fieldset disabled={!!busy} className="space-y-4 min-w-0">
          <div className="space-y-2">
            <label htmlFor="recovery-email" className="text-sm font-medium">注册邮箱</label>
            <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required
              value={email} onChange={event => setEmail(event.target.value)} placeholder="请输入注册时使用的邮箱" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="captcha" className="text-sm font-medium">图片验证码</label>
            <CaptchaInput captcha={captcha} />
          </div>
          <button type="submit" className={buttonClass} disabled={!!busy || !sendingCooldown.ready || sendingCooldown.seconds > 0 || captcha.loading || !captcha.id}>
            {busy === 'send' ? '发送中…' : sendingCooldown.seconds > 0 ? `${sendingCooldown.seconds} 秒后可发送` : '发送邮件验证码'}
          </button>
          <button type="button" onClick={useExistingCode} className="w-full text-sm text-primary hover:underline">已有邮件验证码</button>
        </fieldset>
      </form>}

      {step === 'confirm' && <>
        <p className="text-sm text-muted-foreground break-all">找回邮箱：{email}</p>
        <form onSubmit={confirm} noValidate className="space-y-4">
          <fieldset disabled={!!busy} className="space-y-4 min-w-0">
            <div className="space-y-2">
              <label htmlFor="recovery-code" className="text-sm font-medium">邮件验证码</label>
              <input ref={codeInput} id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                value={code} onChange={event => setCode(event.target.value)} placeholder="输入 6 位数字验证码" className={inputClass} aria-describedby="recovery-code-hint" />
              <p id="recovery-code-hint" className="text-xs text-muted-foreground">验证码 10 分钟内有效。重发后请使用最新邮件中的验证码。</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="recovery-password" className="text-sm font-medium">新密码</label>
              <input id="recovery-password" type="password" autoComplete="new-password" required value={newPassword}
                onChange={event => setNewPassword(event.target.value)} placeholder="至少 6 位，最多 72 字节" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor="recovery-confirm" className="text-sm font-medium">确认新密码</label>
              <input id="recovery-confirm" type="password" autoComplete="new-password" required value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" className={inputClass} />
            </div>
            <button type="submit" className={buttonClass} disabled={!!busy || !checkingCooldown.ready || checkingCooldown.seconds > 0}>
              {busy === 'confirm' ? '重置中…' : checkingCooldown.seconds > 0 ? `${checkingCooldown.seconds} 秒后可重试` : '重置密码'}
            </button>
          </fieldset>
        </form>
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between gap-3 text-sm">
            <button type="button" disabled={!!busy || sendingCooldown.seconds > 0 || !sendingCooldown.ready}
              onClick={() => { setError(''); setResending(true); void captcha.refresh() }} className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
              {sendingCooldown.seconds > 0 ? `${sendingCooldown.seconds} 秒后可重发` : '重新发送'}
            </button>
            <button type="button" disabled={!!busy} className="text-muted-foreground hover:underline"
              onClick={() => { setStep('request'); setError(''); setNotice(''); setCode(''); setNewPassword(''); setConfirmPassword(''); setResending(false); void captcha.refresh() }}>更换邮箱</button>
          </div>
          {resending && <form onSubmit={send} noValidate className="space-y-3">
            <fieldset disabled={!!busy} className="space-y-3 min-w-0">
              <label htmlFor="captcha" className="text-sm font-medium">重新发送前，请填写新的图片验证码</label>
              <CaptchaInput captcha={captcha} />
              <button type="submit" disabled={!!busy || sendingCooldown.seconds > 0 || captcha.loading || !captcha.id} className={buttonClass}>
                {busy === 'send' ? '发送中…' : '发送新验证码'}
              </button>
            </fieldset>
          </form>}
        </div>
      </>}

      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">返回登录</Link></p>
    </div>
  )
}
