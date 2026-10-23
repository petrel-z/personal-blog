'use client'

import { useCaptcha } from '@/client/hooks/useCaptcha'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { loginSchema, type LoginInput } from '@/shared/validations'
import { CaptchaInput } from './CaptchaInput'

export function LoginForm() {
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard'

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)
  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [retryAfter])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      captcha: '',
    },
  })

  const captcha = useCaptcha('login')
  useEffect(() => { setValue('captcha', captcha.value, { shouldValidate: captcha.value.length === 4 }) }, [captcha.value, setValue])

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      // Submit the challenge with the credentials.
      const captchaId = captcha.id
      if (!captchaId) {
        setError('验证码已过期，请刷新页面重试')
        setIsLoading(false)
        return
      }

      // Then attempt login
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        captchaId,
        captchaCode: data.captcha,
        redirect: false,
      })

      if (result?.error) {
        const locked = /^locked_(\d+)$/.exec(result.code || '')
        if (locked) setRetryAfter(Number(locked[1]))
        setError(locked ? '登录尝试过多，请等待后重试'
          : result.code === 'captcha' ? '验证码错误或已过期，请重新输入'
          : result.code === 'unavailable' || result.error !== 'CredentialsSignin' ? '登录服务暂时不可用，请稍后重试'
          : '邮箱或密码错误')
        await captcha.refresh()
        setIsLoading(false)
        return
      }

      // Success - redirect
      if (!result?.ok) throw new Error('Login failed')
      const response = await fetch(`/api/auth/access?callbackUrl=${encodeURIComponent(callbackUrl)}`, {cache:'no-store'})
      const access = await response.json()
      if (!response.ok || access.code !== 2000 || !access.data?.destination) throw new Error('Access unavailable')
      router.replace(access.data.destination)
      router.refresh()
    } catch {
      setError('登录失败，请稍后重试')
      await captcha.refresh()
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          邮箱
        </label>
        <input
          id="email"
          type="email"
          placeholder="admin@example.com"
          className={clsx(
            'w-full px-3 py-2 border rounded-lg bg-background',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            errors.email && 'border-red-500 focus:ring-red-500/50'
          )}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          className={clsx(
            'w-full px-3 py-2 border rounded-lg bg-background',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            errors.password && 'border-red-500 focus:ring-red-500/50'
          )}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Captcha */}
      <div className="space-y-2">
        <label htmlFor="captcha" className="text-sm font-medium">
          验证码
        </label>
        <CaptchaInput
          captcha={captcha}
          error={errors.captcha?.message}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || captcha.loading || !captcha.id || retryAfter > 0}
        className={clsx(
          'w-full py-2 rounded-lg font-medium transition-colors',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {retryAfter > 0 ? `${retryAfter} 秒后重试` : isLoading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}
