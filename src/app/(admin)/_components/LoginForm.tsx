'use client'

import { useCaptcha } from '@/client/hooks/useCaptcha'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/shared/validations'
import { CaptchaInput } from './CaptchaInput'

export function LoginForm() {
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard'

  const [showPassword, setShowPassword] = useState(false)
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
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" aria-busy={isLoading}>
      <div className="admin-field">
        <label htmlFor="email">邮箱</label>
        <input id="email" type="email" autoComplete="email" placeholder="输入你的邮箱"
          aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
        {errors.email && <p id="email-error" role="alert" className="auth-field-error">{errors.email.message}</p>}
      </div>
      <div className="admin-field">
        <div className="auth-password-label"><label htmlFor="password">密码</label><Link href="/forgot-password">忘记密码？</Link></div>
        <div className="auth-password">
          <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="输入密码"
            aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} />
          <button type="button" className="auth-password-toggle" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {errors.password && <p id="password-error" role="alert" className="auth-field-error">{errors.password.message}</p>}
      </div>
      <div className="admin-field">
        <label htmlFor="captcha">图形验证码</label>
        <CaptchaInput captcha={captcha} error={errors.captcha?.message} />
      </div>
      {error && <div role="alert" className="admin-notice admin-notice-error">{error}</div>}
      <button type="submit" disabled={isLoading || captcha.loading || !captcha.id || retryAfter > 0} className="admin-btn admin-btn-primary auth-submit">
        {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {retryAfter > 0 ? `${retryAfter} 秒后重试` : isLoading ? '登录中...' : '登录'}
        {!isLoading && retryAfter === 0 && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </form>
  )
}
