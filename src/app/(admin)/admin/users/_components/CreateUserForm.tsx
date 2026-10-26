'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/client/api'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import type { RoleSummary } from '@/shared/types/authorization'
import { managedUserFormSchema, type ManagedUserFormInput } from '@/shared/validations/account'

interface Props {
  saving: boolean
  onSavingChange: (saving: boolean) => void
  onSaved: () => Promise<void>
}

export function CreateUserForm({ saving, onSavingChange, onSaved }: Props) {
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ManagedUserFormInput>({
    resolver: zodResolver(managedUserFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', roleIds: [] },
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    async function load() {
      try {
        const result = await api.get<RoleSummary[]>('/auth/roles')
        if (!active) return
        if (result.code !== 2000 || !Array.isArray(result.data) || result.data.length === 0) {
          setLoadError(result.code !== 2000 ? result.message || '获取角色列表失败，请重试' : '没有可分配的角色，请联系系统维护人员')
          return
        }
        setRoles(result.data)
        const member = result.data.find(role => role.name === 'member')
        setValue('roleIds', member ? [member.id] : [])
      } catch {
        if (active) setLoadError('获取角色列表失败，请重试')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [attempt, setValue])

  async function submit(data: ManagedUserFormInput) {
    if (saving || loading || loadError) return
    onSavingChange(true)
    setError(null)
    try {
      const result = await api.post('/auth/users', {
        name: data.name, email: data.email, password: data.password, roleIds: data.roleIds,
      })
      if (result.code !== 2010) {
        setError(result.message || '创建用户失败，请稍后重试')
        return
      }
      await onSaved()
    } catch {
      setError('创建用户失败，请稍后重试')
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <form aria-label="创建用户" onSubmit={handleSubmit(submit)} className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">创建用户</h2>
      {loading && <p role="status" className="text-sm text-muted-foreground">正在加载角色...</p>}
      {loadError && (
        <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{loadError}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded border border-current px-3 py-1">重试</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving || loading || !!loadError} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['name', '用户名', 'text', '输入用户名', 'off'],
            ['email', '邮箱', 'email', 'user@example.com', 'off'],
            ['password', '密码', 'password', '至少6位，最多72字节', 'new-password'],
            ['confirmPassword', '确认密码', 'password', '再次输入密码', 'new-password'],
          ] as const).map(([key, label, type, placeholder, autoComplete]) => (
            <div key={key} className="space-y-2">
              <label htmlFor={`managed-${key}`} className="text-sm font-medium">{label}</label>
              <input id={`managed-${key}`} type={type} placeholder={placeholder} autoComplete={autoComplete}
                aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `managed-${key}-error` : undefined}
                className="w-full rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                {...register(key)} />
              {errors[key] && <p id={`managed-${key}-error`} className="text-xs text-red-600">{errors[key]?.message}</p>}
            </div>
          ))}
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">角色（可多选）</legend>
          <div className="flex flex-wrap gap-4">
            {roles.map(role => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={role.id} {...register('roleIds')} className="h-4 w-4 accent-primary" />
                {ROLE_DEFINITIONS[role.name].label}
              </label>
            ))}
          </div>
          {errors.roleIds && <p className="text-xs text-red-600">{errors.roleIds.message}</p>}
          <p className="text-sm text-muted-foreground">普通会员没有后台权限；选择管理员将授予完整后台权限。</p>
        </fieldset>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {saving ? '创建中...' : '创建用户'}
        </button>
      </fieldset>
    </form>
  )
}
