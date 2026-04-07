'use client'

import React, { useState } from 'react'
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      captcha: '',
    },
  })

  const captchaValue = watch('captcha')

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      // TODO: Temporarily skip captcha verification for testing
      // // First verify captcha
      // const captchaResponse = await fetch('/api/captcha', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     captchaId: (window as unknown as { __captchaId?: string }).__captchaId,
      //     code: data.captcha,
      //   }),
      // })
      //
      // const captchaResult = await captchaResponse.json()
      //
      // if (!captchaResult.success) {
      //   setError(captchaResult.error || '验证码错误')
      //   setIsLoading(false)
      //   return
      // }

      // Then attempt login
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError('邮箱或密码错误')
        setIsLoading(false)
        return
      }

      // Success - redirect
      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError('登录失败，请稍后重试')
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
          value={captchaValue || ''}
          onChange={(value) => setValue('captcha', value, { shouldValidate: true })}
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
        disabled={isLoading}
        className={clsx(
          'w-full py-2 rounded-lg font-medium transition-colors',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isLoading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}
