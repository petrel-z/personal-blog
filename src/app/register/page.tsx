'use client'

import { useCaptcha } from '@/client/hooks/useCaptcha'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { signIn } from 'next-auth/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@/shared/validations'
import { CaptchaInput } from '../(admin)/_components/CaptchaInput'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/admin/AuthLayout'

export default function RegisterPage() {
  const router = useRouter()
  const [visiblePasswords, setVisiblePasswords] = useState({ password: false, confirmPassword: false })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
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

  const captcha = useCaptcha('register')
  useEffect(() => { setValue('captcha', captcha.value, { shouldValidate: captcha.value.length === 4 }) }, [captcha.value, setValue])

  const onSubmit = async (data: RegisterInput) => {
    setError(null)
    setSuccess(null)

    try {
      // Submit the challenge with the registration request.
      const captchaId = captcha.id
      if (!captchaId) {
        setError('验证码已过期，请刷新页面重试')
        return
      }

      const result = await signIn('registration', {
        name: data.name,
        email: data.email,
        password: data.password,
        captchaId,
        captchaCode: data.captcha,
        redirect: false,
        redirectTo: '/',
      })

      if (result?.ok && !result.error) {
        setSuccess('注册成功，正在进入首页')
        reset()
        router.replace('/')
        router.refresh()
      } else {
        setError(result?.code === 'registration_conflict' ? '该邮箱已被注册'
          : result?.code === 'registration_captcha' ? '验证码错误或已过期'
          : result?.code === 'registration_invalid' ? '注册信息验证失败，请检查后重试'
          : '注册服务暂时不可用，请稍后重试')
        await captcha.refresh()
      }
    } catch {
      setError('注册失败，请稍后重试')
      await captcha.refresh()
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading"><h1>创建账号</h1><p>从阅读、交流与分享开始。</p></div>
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" aria-busy={isSubmitting}>
        {success && <div role="status" className="admin-notice">{success}。你的账号为普通会员。<Link href="/">前往博客首页</Link></div>}
        {error && <div role="alert" className="admin-notice admin-notice-error">{error}</div>}
        <div className="admin-field">
          <label htmlFor="name">用户名</label>
          <input id="name" type="text" autoComplete="nickname" placeholder="输入用户名" aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} />
          {errors.name && <p id="name-error" role="alert" className="auth-field-error">{errors.name.message}</p>}
        </div>
        <div className="admin-field">
          <label htmlFor="email">邮箱</label>
          <input id="email" type="email" autoComplete="email" placeholder="输入你的邮箱" aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
          {errors.email && <p id="email-error" role="alert" className="auth-field-error">{errors.email.message}</p>}
        </div>
        {(['password', 'confirmPassword'] as const).map(field => (
          <div className="admin-field" key={field}>
            <label htmlFor={field}>{field === 'password' ? '密码' : '确认密码'}</label>
            <div className="auth-password">
              <input id={field} type={visiblePasswords[field] ? 'text' : 'password'} autoComplete="new-password"
                placeholder={field === 'password' ? '至少6位，最多72字节' : '再次输入密码'}
                aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} {...register(field)} />
              <button type="button" className="auth-password-toggle" aria-label={`${visiblePasswords[field] ? '隐藏' : '显示'}${field === 'password' ? '密码' : '确认密码'}`}
                aria-pressed={visiblePasswords[field]} onClick={() => setVisiblePasswords(value => ({ ...value, [field]: !value[field] }))}>
                {visiblePasswords[field] ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {errors[field] && <p id={`${field}-error`} role="alert" className="auth-field-error">{errors[field]?.message}</p>}
          </div>
        ))}
        <div className="admin-field">
          <label htmlFor="captcha">图形验证码</label>
          <CaptchaInput captcha={captcha} error={errors.captcha?.message} />
        </div>
        <button type="submit" disabled={isSubmitting || !!success || captcha.loading || !captcha.id} className="admin-btn admin-btn-primary auth-submit">
          {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? '注册中…' : '注册'}
        </button>
      </form>
      <p className="auth-switch">已有账号？<Link href="/login">立即登录</Link></p>
      <p className="auth-permissions">注册后为普通会员，不自动获得后台权限。</p>
    </AuthLayout>
  )
}
