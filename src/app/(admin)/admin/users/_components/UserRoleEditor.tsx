'use client'

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { api } from '@/client/api'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import type { RoleSummary } from '@/shared/types/authorization'

interface Props {
  user: { id: string; email: string; roles: { id: string; name: string }[] }
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}

export function UserRoleEditor({ user, isSelf, onClose, onSaved }: Props) {
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setLoaded(false)
    async function loadRoles() {
      try {
        const result = await api.get<RoleSummary[]>('/auth/roles')
        if (!active) return
        if (result.code !== 2000) {
          setError(result.message || '获取角色列表失败，请重试')
          return
        }
        const availableRoles = result.data
        if (!Array.isArray(availableRoles) || availableRoles.length === 0) {
          setError('没有可分配的角色，请联系系统维护人员')
          return
        }
        setRoles(availableRoles)
        setSelected(user.roles.filter(role => availableRoles.some(available => available.id === role.id)).map(role => role.id))
        setLoaded(true)
      } catch {
        if (active) setError('获取角色列表失败，请重试')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadRoles()
    return () => { active = false }
  }, [user, attempt])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const result = await api.patch(`/auth/users/${user.id}/roles`, { roleIds: selected })
      if (result.code !== 2000) {
        setError(result.message || '保存角色失败，请重试')
        return
      }
      onSaved()
    } catch {
      setError('保存角色失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const removesSelfAdmin = isSelf && user.roles.some(role => role.name === 'admin')
    && !roles.some(role => role.name === 'admin' && selected.includes(role.id))
  const hasUnavailableRoles = loaded && user.roles.some(role => !roles.some(available => available.id === role.id))

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !saving) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">分配用户角色</Dialog.Title>
          <Dialog.Description className="mt-2 break-all text-sm text-muted-foreground">
            {user.email} · 可选择多个角色，保存后立即生效。
          </Dialog.Description>
          <form onSubmit={event => { event.preventDefault(); if (loaded && !saving) void save() }} className="mt-5 space-y-4">
            {loading ? <p role="status" className="text-sm text-muted-foreground">正在加载角色…</p> : loaded && (
              <fieldset disabled={saving} className="space-y-3">
                <legend className="sr-only">选择用户角色</legend>
                {roles.map(role => (
                  <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent/50">
                    <input
                      type="checkbox"
                      aria-label={ROLE_DEFINITIONS[role.name].label}
                      checked={selected.includes(role.id)}
                      onChange={event => setSelected(current => event.target.checked ? [...current, role.id] : current.filter(id => id !== role.id))}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium">{ROLE_DEFINITIONS[role.name].label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{ROLE_DEFINITIONS[role.name].description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {hasUnavailableRoles && <p className="text-sm text-amber-700">此用户有未列出的旧角色，保存后将移除这些角色。</p>}
            {loaded && selected.length === 0 && <p className="text-sm text-muted-foreground">未选择角色，保存后该用户将失去全部后台权限。</p>}
            {loaded && removesSelfAdmin && <p className="text-sm text-amber-700">你正在移除自己的管理员角色，保存成功后将按新权限刷新页面。</p>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">取消</button>
              {!loading && !loaded ? (
                <button type="button" onClick={() => setAttempt(current => current + 1)} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">重试</button>
              ) : (
                <button type="submit" disabled={loading || saving || !loaded} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                  {saving ? '保存中…' : '保存角色'}
                </button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
