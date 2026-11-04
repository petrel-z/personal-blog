'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminPageHeader, AdminPanel, AdminState, AdminBadge } from '@/components/admin/ui'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import type { BuiltinRoleName } from '@/shared/types/authorization'
import { UserRoleEditor } from './_components/UserRoleEditor'
import { CreateUserForm } from './_components/CreateUserForm'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  createdAt: string
  roles: { id: string; name: string }[]
  _count: {
    posts: number
  }
}

export default function UsersPage() {
  const { isAuthenticated, isLoading: authLoading, can, user: currentUser } = useAuth()
  const router = useRouter()
  const canAssignRoles = can('user:assign-role')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    fetchUsers()
  }, [isAuthenticated, authLoading])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await api.get('/auth/users') as { code: number; data: User[]; message: string }

      if (result.code === 2000) {
        setUsers(result.data || [])
      } else {
        setUsers([])
        setError(result.message || '获取用户列表失败')
      }
    } catch {
      setUsers([])
      setError('获取用户列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="用户管理" description="管理账户与角色，为每位成员分配合适的访问权限。" actions={can('user:create') && <button type="button" disabled={isCreating} onClick={() => { setShowCreateForm(value => !value); setCreateSuccess(null) }} className="admin-btn admin-btn-primary">{showCreateForm ? '取消添加' : '添加用户'}</button>} />
      {createSuccess && <p role="status" className="text-sm text-green-700">{createSuccess}</p>}
      {can('user:create') && showCreateForm && (
        <CreateUserForm saving={isCreating} onSavingChange={setIsCreating}
          onSaved={async () => {
            setShowCreateForm(false)
            setCreateSuccess('用户创建成功')
            await fetchUsers()
            router.refresh()
          }} />
      )}

      {/* Users Table */}
      {roleSuccess && <p role="status" className="text-sm text-green-700">{roleSuccess}</p>}
      <AdminPanel title="全部用户" description={`共 ${users.length} 位成员`}>
      {authLoading || isLoading ? <AdminState kind="loading" title="正在加载用户…" /> : error ? <AdminState kind="error" title="用户列表暂不可用" description={error} onRetry={() => void fetchUsers()} /> : users.length === 0 ? <AdminState title="暂无用户" /> : <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">用户名</th>
              <th className="px-4 py-3 text-left text-sm font-medium">邮箱</th>
              <th className="px-4 py-3 text-left text-sm font-medium">角色</th>
              <th className="px-4 py-3 text-left text-sm font-medium">文章数</th>
              <th className="px-4 py-3 text-left text-sm font-medium">注册时间</th>
              {canAssignRoles && <th className="px-4 py-3 text-left text-sm font-medium">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={canAssignRoles ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                  {error ? '用户列表暂不可用' : '暂无用户'}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-accent/50">
                  <td data-label="用户名">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name?.charAt(0) || user.email.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium">{user.name || '-'}</span>
                    </div>
                  </td>
                  <td data-label="邮箱">
                    {user.email}
                  </td>
                  <td data-label="角色">
                    {user.roles.length === 0 ? (
                      <span className="text-sm text-muted-foreground">未分配</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map(role => (
                          <AdminBadge key={role.id} tone={role.name === 'admin' ? 'blue' : 'neutral'}>
                            {Object.hasOwn(ROLE_DEFINITIONS, role.name)
                              ? ROLE_DEFINITIONS[role.name as BuiltinRoleName].label
                              : role.name}
                          </AdminBadge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td data-label="文章数">
                    {user._count.posts}
                  </td>
                  <td data-label="注册时间">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  {canAssignRoles && (
                    <td data-label="操作">
                      <button
                        type="button"
                        aria-label={`分配角色：${user.email}`}
                        onClick={() => { setRoleSuccess(null); setEditingUser(user) }}
                        className="admin-btn admin-btn-ghost"
                      >分配角色</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}
      </AdminPanel>
      {canAssignRoles && editingUser && (
        <UserRoleEditor
          key={editingUser.id}
          user={editingUser}
          isSelf={editingUser.id === currentUser?.id}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            setRoleSuccess('角色已更新')
            void fetchUsers()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
