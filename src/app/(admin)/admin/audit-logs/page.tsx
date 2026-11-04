'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminPanel, AdminState, AdminPagination } from '@/components/admin/ui'
import { api } from '@/client/api'
import { useAuth } from '../../_components'

interface AuditLog {
  id: string
  userId?: string
  action: string
  target?: string
  details?: string
  ipAddress?: string
  createdAt: string
  user?: {
    name?: string
    email: string
  }
}

export default function AuditLogsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await api.get('/audit-logs', { page, pageSize: 20 }) as { code: number; data: { items: AuditLog[]; total: number; totalPages: number }; message: string }
      if (result.code === 2000 && result.data) {
        setLogs(result.data.items || [])
        setTotalPages(result.data.totalPages || 1)
      } else { setError(result.message || '获取审计日志失败') }
    } catch {
      setError('获取审计日志失败')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    void fetchLogs()
  }, [isAuthenticated, authLoading, fetchLogs])

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('POST')) return 'text-green-600 bg-green-50'
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-600 bg-red-50'
    if (action.includes('UPDATE') || action.includes('PUT') || action.includes('PATCH')) return 'text-blue-600 bg-blue-50'
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'text-purple-600 bg-purple-50'
    return 'text-gray-600 bg-gray-50'
  }

  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'USER_CREATE': '创建后台用户',
      'USER_ROLE_UPDATE': '调整用户角色',
      'ROLE_PERMISSION_UPDATE': '调整角色权限',
      'POST_CREATE': '创建',
      'POST_UPDATE': '更新',
      'POST_DELETE': '删除',
      'CATEGORY_CREATE': '创建分类',
      'CATEGORY_UPDATE': '更新分类',
      'CATEGORY_DELETE': '删除分类',
      'TAG_CREATE': '创建标签',
      'TAG_UPDATE': '更新标签',
      'TAG_DELETE': '删除标签',
      'COMMENT_APPROVE': '审核通过',
      'COMMENT_REJECT': '审核拒绝',
      'COMMENT_DELETE': '删除评论',
      'LOGIN': '登录',
      'LOGOUT': '登出',
      'SETTINGS_UPDATE': '更新设置',
    }
    return actionMap[action] || action
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="审计日志" description="追溯后台操作记录，所有日志仅供查看。" />
      <AdminPanel title="操作记录" description="按发生时间查看用户、操作与来源。">
      {authLoading || isLoading ? <AdminState kind="loading" title="正在加载审计日志…" /> : error ? <AdminState kind="error" title="日志加载失败" description={error} onRetry={() => void fetchLogs()} /> : logs.length === 0 ? <AdminState title="暂无日志" description="后台操作发生后，将在这里留下记录。" /> : <>
      {/* Logs Table */}
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              <th className="px-4 py-3 text-left text-sm font-medium">目标</th>
              <th className="px-4 py-3 text-left text-sm font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  暂无日志
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-accent/50">
                  <td data-label="时间">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td data-label="用户">
                    <div className="text-sm">
                      <p className="font-medium">{log.user?.name || '系统'}</p>
                      <p className="text-muted-foreground text-xs">{log.user?.email}</p>
                    </div>
                  </td>
                  <td data-label="操作">
                    <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td data-label="目标">
                    {log.target || '-'}
                  </td>
                  <td data-label="IP" className="font-mono">
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </>}
      </AdminPanel>
    </div>
  )
}
