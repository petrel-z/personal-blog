'use client'

import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchLogs()
  }, [isAuthenticated, authLoading, page])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/audit-logs', { page, pageSize: 20 }) as { code: number; data: { items: AuditLog[]; total: number; totalPages: number }; message: string }
      if (result.code === 2000 && result.data) {
        setLogs(result.data.items || [])
        setTotalPages(result.data.totalPages || 1)
      }
    } catch {
      setError('获取审计日志失败')
    } finally {
      setIsLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('POST')) return 'text-green-600 bg-green-50'
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-600 bg-red-50'
    if (action.includes('UPDATE') || action.includes('PUT') || action.includes('PATCH')) return 'text-blue-600 bg-blue-50'
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'text-purple-600 bg-purple-50'
    return 'text-gray-600 bg-gray-50'
  }

  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
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
      <div>
        <h1 className="text-2xl font-bold">审计日志</h1>
        <p className="text-sm text-muted-foreground mt-1">
          记录所有后台操作历史
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
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
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p className="font-medium">{log.user?.name || '系统'}</p>
                      <p className="text-muted-foreground text-xs">{log.user?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {log.target || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
