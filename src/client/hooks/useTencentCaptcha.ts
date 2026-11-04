import { useCallback, useEffect, useRef } from 'react'

export class TencentCaptchaError extends Error {}
type CaptchaResult = { ret: number; ticket?: string; randstr?: string }

export function useTencentCaptcha() {
  const appId = process.env.NEXT_PUBLIC_CAPTCHA_APP_ID || ''
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => () => { cancel.current?.() }, [])

  const openCaptcha = useCallback(() => new Promise<{ ticket: string; randstr: string }>((resolve, reject) => {
    if (!appId || typeof window.TencentCaptcha !== 'function') {
      reject(new TencentCaptchaError('验证码尚未就绪，请稍后重试或刷新页面'))
      return
    }
    cancel.current?.()
    let widget: InstanceType<Window['TencentCaptcha']> | undefined
    let settled = false
    const finish = (error?: TencentCaptchaError, proof?: { ticket: string; randstr: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cancel.current = null
      try { widget?.destroy() } catch {}
      if (error) reject(error)
      else resolve(proof!)
    }
    const timer = setTimeout(() => finish(new TencentCaptchaError('验证码操作超时，请重新验证')), 120_000)
    cancel.current = () => finish(new TencentCaptchaError('已取消人机验证，请重试'))
    try {
      widget = new window.TencentCaptcha(appId, (result: CaptchaResult) => {
        if (result.ret === 0 && typeof result.ticket === 'string' && result.ticket &&
            typeof result.randstr === 'string' && result.randstr) {
          finish(undefined, { ticket: result.ticket, randstr: result.randstr })
        } else finish(new TencentCaptchaError('人机验证未完成，请重试'))
      }, {})
      if (!settled) widget.show()
    } catch { finish(new TencentCaptchaError('验证码加载失败，请刷新页面后重试')) }
  }), [appId])

  return { openCaptcha }
}
