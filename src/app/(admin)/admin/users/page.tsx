'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clsx } from 'clsx'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import { registerSchema, type RegisterInput } from '@/shared/validations'
import { CaptchaInput } from '../../_components/CaptchaInput'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  createdAt: string
  _count: {
    posts: number
  }
}

export default function UsersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)

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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchUsers()
  }, [isAuthenticated, authLoading])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/auth/users') as { code: number; data: User[]; message: string }

      if (result.code === 2000) {
        setUsers(result.data || [])
      }
    } catch {
      setError('获取用户列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmitRegister = async (data: RegisterInput) => {
    setIsRegistering(true)
    setRegisterError(null)
    setRegisterSuccess(null)

    try {
      // Verify captcha first
      const captchaId = (window as unknown as { __captchaId?: string }).__captchaId
      if (!captchaId) {
        setRegisterError('验证码已过期，请刷新页面重试')
        setIsRegistering(false)
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
        setRegisterError(captchaResult.message || '验证码错误')
        setIsRegistering(false)
        return
      }

      // Register user
      const result = await api.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      })

      if (result.code === 2000 || result.code === 2010) {
        setRegisterSuccess('用户注册成功')
        reset()
        setShowRegisterForm(false)
        fetchUsers()
      } else {
        setRegisterError(result.message || '注册失败')
      }
    } catch {
      setRegisterError('注册失败，请稍后重试')
    } finally {
      setIsRegistering(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理系统用户账户
          </p>
        </div>
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          {showRegisterForm ? '关闭注册' : '添加用户'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Register Form */}
      {showRegisterForm && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">注册新用户</h2>

          {registerSuccess && (
            <div className="p-3 mb-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
              {registerSuccess}
            </div>
          )}

          {registerError && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
              {registerError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmitRegister)} className="space-y-4">
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
              disabled={isRegistering}
              className={clsx(
                'w-full py-2 rounded-lg font-medium transition-colors',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isRegistering ? '注册中...' : '注册'}
            </button>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">用户名</th>
              <th className="px-4 py-3 text-left text-sm font-medium">邮箱</th>
              <th className="px-4 py-3 text-left text-sm font-medium">文章数</th>
              <th className="px-4 py-3 text-left text-sm font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name?.charAt(0) || user.email.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium">{user.name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    {user._count.posts}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
