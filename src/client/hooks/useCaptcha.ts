'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptchaPurpose } from '@/shared/types/auth'

export function useCaptcha(purpose: CaptchaPurpose) {
  const [id, setId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const objectUrl = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const current = ++sequence.current
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
    setId(null)
    setImageUrl(null)
    setValue('')
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/captcha?purpose=${purpose}&t=${Date.now()}`, {
        signal: request.signal, cache: 'no-store',
      })
      const nextId = response.headers.get('X-Captcha-Id')
      if (!response.ok || !nextId || !response.headers.get('Content-Type')?.includes('image/svg+xml')) {
        throw new Error('Invalid captcha response')
      }
      const blob = await response.blob()
      if (current !== sequence.current) return
      const url = URL.createObjectURL(blob)
      objectUrl.current = url
      setId(nextId)
      setImageUrl(url)
    } catch {
      if (current === sequence.current && !request.signal.aborted) setError('验证码加载失败，请重试')
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [purpose])

  const dispose = useCallback(() => {
    ++sequence.current
    controller.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }, [])

  useEffect(() => {
    void refresh()
    return dispose
  }, [refresh, dispose])

  return { id, imageUrl, value, setValue, loading, error, refresh }
}

export type CaptchaState = ReturnType<typeof useCaptcha>
