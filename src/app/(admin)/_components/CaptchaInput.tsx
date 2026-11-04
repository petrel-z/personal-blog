'use client'

import Image from 'next/image'
import { clsx } from 'clsx'
import type { CaptchaState } from '@/client/hooks/useCaptcha'

export function CaptchaInput({ captcha, error }: { captcha: CaptchaState; error?: string }) {
  return (
    <div className="space-y-2">
      <div className="auth-captcha-row flex gap-2 items-center">
        <input
          id="captcha" aria-label="验证码" type="text" value={captcha.value}
          onChange={event => captcha.setValue(event.target.value.toUpperCase().slice(0, 4))}
          placeholder="验证码" maxLength={4} disabled={captcha.loading}
          autoComplete="off" spellCheck={false}
          aria-invalid={!!(captcha.error || error)} aria-describedby={captcha.error || error ? 'captcha-error captcha-help' : 'captcha-help'}
          className={clsx('min-w-0 flex-1 px-2 py-2 border rounded-lg bg-background uppercase tracking-widest text-center font-mono text-sm', error && 'border-red-500')}
        />
        {captcha.imageUrl && (
          <button type="button" className="auth-captcha-image" onClick={() => void captcha.refresh()} title="点击刷新验证码" aria-label="更换验证码图片">
            <Image src={captcha.imageUrl} alt="验证码" width={112} height={36} unoptimized className="rounded border border-border" />
          </button>
        )}
      </div>
      <div id="captcha-help" className="auth-captcha-help flex items-center gap-2 text-xs text-muted-foreground">
        <span>看不清？点击图片换一张</span>
        <button type="button" onClick={() => void captcha.refresh()} disabled={captcha.loading}
          className="py-2 text-primary disabled:opacity-50" aria-label="刷新验证码">
          {captcha.loading ? '加载中…' : '刷新'}
        </button>
      </div>
      {(captcha.error || error) && <p id="captcha-error" role="alert" className="text-xs text-red-500">{captcha.error || error}</p>}
    </div>
  )
}
