'use client'

import { useState } from 'react'
import { api } from '@/client/api'
import { PERMISSIONS, PERMISSION_DEFINITIONS, isAdminPermission, type Permission } from '@/shared/permissions'
import type { RoleSummary } from '@/shared/types/authorization'

const groups = new Map<string, Permission[]>()
for (const code of PERMISSIONS) {
  if (isAdminPermission(code)) continue
  const group = PERMISSION_DEFINITIONS[code].group
  groups.set(group, [...(groups.get(group) ?? []), code])
}

interface Props {
  role: RoleSummary
  saving: boolean
  onSavingChange: (saving: boolean) => void
  onCancel: () => void
  onSaved: () => Promise<void>
}

export function RolePermissionEditor({ role, saving, onSavingChange, onCancel, onSaved }: Props) {
  const [selected, setSelected] = useState<Permission[]>(role.permissions)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    onSavingChange(true)
    setError(null)
    try {
      const result = await api.patch(`/auth/roles/${role.id}/permissions`, { permissions: selected })
      if (result.code !== 2000) {
        setError(result.message || '保存权限失败，请重试')
        return
      }
      await onSaved()
    } catch {
      setError('保存权限失败，请重试')
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <form onSubmit={event => { event.preventDefault(); void save() }} className="space-y-4">
      <p className="text-sm text-muted-foreground">选中的权限适用于该角色的所有成员，保存后在下一次请求时生效。</p>
      <fieldset disabled={saving} className="space-y-4">
        <legend className="mb-4 font-medium">业务权限（已选 {selected.length} 项）</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from(groups, ([group, codes]) => (
            <fieldset key={group} className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">{group}</legend>
              <div className="space-y-3">
                {codes.map(code => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(code)}
                      onChange={event => setSelected(current => event.target.checked
                        ? [...current, code] : current.filter(value => value !== code))}
                      className="h-4 w-4 accent-primary" />
                    {PERMISSION_DEFINITIONS[code].label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </fieldset>
      {selected.length === 0 && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          保存后将撤销此角色的全部后台权限，仅拥有此角色的用户将无法进入后台；其他角色授予的权限仍有效。
        </p>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {saving ? '保存中...' : '保存权限'}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
          取消
        </button>
      </div>
    </form>
  )
}
