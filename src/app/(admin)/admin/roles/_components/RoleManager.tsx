'use client'

import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { api } from '@/client/api'
import { PERMISSION_DEFINITIONS, type Permission } from '@/shared/permissions'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import type { BuiltinRoleName, RoleSummary } from '@/shared/types/authorization'

export default function RoleManager() {
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<RoleSummary[]>('/auth/roles')
      if (result.code !== 2000 || !Array.isArray(result.data)) {
        setRoles([])
        setError(result.code === 4010 ? '登录已失效，请重新登录' : result.code === 4030
          ? '当前账号没有查看角色的权限' : '获取角色列表失败，请稍后重试')
        return
      }
      setRoles(result.data)
    } catch {
      setRoles([])
      setError('获取角色列表失败，请稍后重试')
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
      <div>
        <h1 className="text-2xl font-bold">角色管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看角色的成员数量和当前生效的后台权限</p>
      </div>

      {loading ? (
        <p role="status" className="py-12 text-center text-muted-foreground">正在加载角色...</p>
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
            <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
              <nav aria-label="角色列表" className="space-y-2">
                {roles.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selectedRole.id === role.id}
                    onClick={() => setSelectedId(role.id)}
                    className={clsx('flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left',
                      selectedRole.id === role.id ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent/50')}
                  >
                    <span className="font-medium">{ROLE_DEFINITIONS[role.name].label}</span>
                    <span className="text-xs text-muted-foreground">{role.memberCount} 位成员</span>
                  </button>
                ))}
              </nav>

              <section aria-label="角色详情" className="space-y-5 rounded-lg border bg-card p-5 md:p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{ROLE_DEFINITIONS[selectedRole.name].label}</h2>
                    {(selectedRole.name === 'admin' || selectedRole.name === 'member') && (
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">权限只读</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedRole.description || ROLE_DEFINITIONS[selectedRole.name].description}
                  </p>
                  <p className="text-sm">有效成员：{selectedRole.memberCount} 人</p>
                </div>

                <div className="border-t pt-5">
                  <h3 className="mb-4 font-medium">后台权限（{selectedRole.permissions.length}）</h3>
                  {groups.size === 0 ? (
                    <p className="text-sm text-muted-foreground">该角色暂无后台权限</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Array.from(groups, ([group, codes]) => (
                        <div key={group} className="rounded-lg border p-4">
                          <h4 className="mb-3 text-sm font-medium">{group}</h4>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {codes.map(code => <li key={code}>{PERMISSION_DEFINITIONS[code].label}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
