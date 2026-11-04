'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { AdminPageHeader, AdminBadge, AdminState } from '@/components/admin/ui'
import { api } from '@/client/api'
import { PERMISSION_DEFINITIONS, type Permission } from '@/shared/permissions'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import type { BuiltinRoleName, RoleSummary } from '@/shared/types/authorization'
import { useAuth } from '../../../_components'
import { RolePermissionEditor } from './RolePermissionEditor'

export default function RoleManager() {
  const router = useRouter()
  const { can } = useAuth()
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<RoleSummary[]>('/auth/roles')
      if (result.code !== 2000 || !Array.isArray(result.data)) {
        setRoles([])
        setError(result.code === 4010 ? '登录已失效，请重新登录' : result.code === 4030
          ? '当前账号没有查看角色的权限' : '获取角色列表失败，请稍后重试')
        return false
      }
      setRoles(result.data)
      return true
    } catch {
      setRoles([])
      setError('获取角色列表失败，请稍后重试')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRoles() }, [loadRoles])

  const selectedRole = roles.find(role => role.id === selectedId) ?? roles[0]
  const missingRoles = (Object.keys(ROLE_DEFINITIONS) as BuiltinRoleName[])
    .filter(name => !roles.some(role => role.name === name))
  const groups = new Map<string, Permission[]>()
  for (const code of selectedRole?.permissions ?? []) {
    const group = PERMISSION_DEFINITIONS[code].group
    groups.set(group, [...(groups.get(group) ?? []), code])
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="角色管理" description="按角色分配权限，让每位成员专注于自己的工作。" />
      {notice && !loading && !error && <p role="status" className="text-sm text-green-700">{notice}</p>}

      {loading ? (
        <AdminState kind="loading" title="正在加载角色..." />
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void loadRoles()} className="rounded-lg border border-current px-3 py-1.5 text-sm">
            重试
          </button>
        </div>
      ) : (
        <>
          {missingRoles.length > 0 && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              角色数据不完整，缺少：{missingRoles.map(name => ROLE_DEFINITIONS[name].label).join('、')}。
              请联系系统维护人员完成角色初始化。
            </p>
          )}
          {selectedRole && (
            <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
              <nav aria-label="角色列表" className="space-y-4">
                {roles.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    disabled={saving}
                    aria-pressed={selectedRole.id === role.id}
                    onClick={() => { setSelectedId(role.id); setEditingId(null); setNotice(null) }}
                    className={clsx('flex w-full items-center justify-between gap-3 rounded-lg border p-5 text-left disabled:opacity-50',
                      selectedRole.id === role.id ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent/50')}
                  >
                    <span className="block w-full"><span className="flex items-center justify-between gap-3"><span className="font-semibold">{ROLE_DEFINITIONS[role.name].label}</span><span className="text-xs text-muted-foreground">{role.memberCount} 人</span></span><span className="mt-3 block text-xs leading-relaxed text-muted-foreground">{ROLE_DEFINITIONS[role.name].description}</span></span>
                  </button>
                ))}
              </nav>

              <section aria-label="角色详情" className="admin-panel space-y-5 p-6 md:p-8">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{ROLE_DEFINITIONS[selectedRole.name].label}</h2>
                    {(selectedRole.name === 'admin' || selectedRole.name === 'member') && (
                      <AdminBadge>权限只读</AdminBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedRole.description || ROLE_DEFINITIONS[selectedRole.name].description}
                  </p>
                  <p className="text-sm">有效成员：{selectedRole.memberCount} 人</p>
                  {can('role:update') && (selectedRole.name === 'editor' || selectedRole.name === 'reviewer') && editingId !== selectedRole.id && (
                    <button type="button" onClick={() => { setEditingId(selectedRole.id); setNotice(null) }}
                      className="admin-btn admin-btn-primary">编辑权限</button>
                  )}
                </div>

                <div className="border-t pt-5">
                  {editingId === selectedRole.id ? (
                    <RolePermissionEditor key={selectedRole.id} role={selectedRole} saving={saving}
                      onSavingChange={setSaving} onCancel={() => setEditingId(null)}
                      onSaved={async () => {
                        setEditingId(null)
                        if (await loadRoles()) setNotice(`${ROLE_DEFINITIONS[selectedRole.name].label}权限已更新`)
                        router.refresh()
                      }} />
                  ) : <>
                  <h3 className="mb-4 font-medium">后台权限（{selectedRole.permissions.length}）</h3>
                  {groups.size === 0 ? (
                    <p className="text-sm text-muted-foreground">该角色暂无后台权限</p>
                  ) : (
                    <div className="space-y-6">
                      {Array.from(groups, ([group, codes]) => (
                        <div key={group} className="grid gap-4 border-b pb-6 last:border-0 md:grid-cols-[130px_minmax(0,1fr)]">
                          <h4 className="text-sm font-medium text-muted-foreground">{group}</h4>
                          <ul className="grid gap-4 text-sm sm:grid-cols-2">
                            {codes.map(code => <li key={code} className="flex items-center gap-2"><span aria-hidden="true" className="text-primary">✓</span><span>{PERMISSION_DEFINITIONS[code].label}</span></li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  </>}
                </div>
                <p className="admin-notice text-xs">管理员与普通会员权限只读；业务权限变更适用于该角色的所有成员。</p>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
