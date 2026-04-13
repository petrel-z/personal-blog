'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'

interface CaptchaInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function CaptchaInput({ value, onChange, error }: CaptchaInputProps) {
  const [captchaUrl, setCaptchaUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchCaptcha = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/captcha?' + Date.now())
      const captchaId = response.headers.get('X-Captcha-Id')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setCaptchaUrl(url)

      // Store captcha ID globally for verification
      if (captchaId) {
        (window as unknown as { __captchaId?: string }).__captchaId = captchaId
      }
    } catch (err) {
      console.error('Failed to fetch captcha:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 4)
    onChange(val)
  }

  const handleClick = () => {
    // Revoke old URL to prevent memory leaks
    if (captchaUrl) {
      URL.revokeObjectURL(captchaUrl)
    }
    fetchCaptcha()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="验证码"
          maxLength={4}
          className={clsx(
            'flex-1 px-2 py-2 border rounded-lg bg-background',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'uppercase tracking-widest text-center font-mono text-sm',
            'placeholder:normal-case placeholder:tracking-normal placeholder:text-base',
            error && 'border-red-500 focus:ring-red-500/50'
          )}
          autoComplete="off"
        />
        {/* Captcha Image */}
        {captchaUrl && (
          <Image
            src={captchaUrl}
            alt="验证码"
            width={112}
            height={36}
            className="rounded border border-border cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 object-cover"
            onClick={handleClick}
            title="点击刷新验证码"
            unoptimized
          />
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          className={clsx(
            'p-2 border rounded-lg bg-sidebar',
            'hover:bg-sidebar-active transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center flex-shrink-0'
          )}
          aria-label="刷新验证码"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
