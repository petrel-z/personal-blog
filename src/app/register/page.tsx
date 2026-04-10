'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clsx } from 'clsx'
import { registerSchema, type RegisterInput } from '@/shared/validations'
import { CaptchaInput } from '../(admin)/_components/CaptchaInput'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      captcha: '',
    },
  })

  const captchaValue = watch('captcha')

  const onSubmit = async (data: RegisterInput) => {
    setError(null)
    setSuccess(null)

    try {
      // Verify captcha first
      const captchaId = (window as unknown as { __captchaId?: string }).__captchaId
      if (!captchaId) {
        setError('验证码已过期，请刷新页面重试')
        return
      }

      const captchaResponse = await fetch('/api/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captchaId,
          code: data.captcha,
        }),
      })

      const captchaResult = await captchaResponse.json()

      if (captchaResult.code !== 2000) {
        setError(captchaResult.message || '验证码错误')
        return
      }

      // Register user
      const result = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      const response = await result.json()

      if (response.code === 2000 || response.code === 2010) {
        setSuccess('注册成功！请前往登录')
        reset()
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      } else {
        setError(response.message || '注册失败')
      }
    } catch {
      setError('注册失败，请稍后重试')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 border rounded-lg bg-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold">用户注册</h1>
          <p className="text-sm text-muted-foreground">
            创建一个新账号
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        }>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {success && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
                {success}
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                用户名
              </label>
              <input
                id="name"
                type="text"
                placeholder="输入用户名"
                className={clsx(
                  'w-full px-3 py-2 border rounded-lg bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.name && 'border-red-500 focus:ring-red-500/50'
                )}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                placeholder="user@example.com"
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
                placeholder="至少6位"
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                className={clsx(
                  'w-full px-3 py-2 border rounded-lg bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.confirmPassword && 'border-red-500 focus:ring-red-500/50'
                )}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
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

            {/* Submit */}
            <button
              type="submit"
              className={clsx(
                'w-full py-2 rounded-lg font-medium transition-colors',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90'
              )}
            >
              注册
            </button>
          </form>
        </Suspense>

        <p className="text-xs text-center text-muted-foreground">
          已有账号？{' '}
          <Link href="/login" className="text-primary hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
