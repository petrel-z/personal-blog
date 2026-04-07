'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { CommentWithReplies, PostWithRelations } from '@/shared/types'

interface AdminComment extends CommentWithReplies {
  email?: string
  post?: {
    id: string
    title: string
    slug: string
  }
  ip?: string
  userAgent?: string
}

export default function CommentsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [comments, setComments] = useState<AdminComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all')
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchComments()
  }, [isAuthenticated, authLoading, page, filter])

  const fetchComments = async () => {
    try {
      setIsLoading(true)
      const params: Record<string, string | number> = { page, pageSize: 20 }
      if (filter !== 'all') {
        params.status = filter
      }

      const result = await api.get('/comments/admin', params) as { code: number; data: { items: AdminComment[]; total: number; totalPages: number }; message: string }

      if (result.code === 2000 && result.data) {
        setComments(result.data.items || [])
        setTotalPages(result.data.totalPages || 1)
      }
    } catch {
      setError('获取评论列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await api.put(`/comments/${id}/moderate`, { action: 'approve' })
      if (result.code === 2000) {
        fetchComments()
      }
    } catch {
      setError('审核操作失败')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await api.put(`/comments/${id}/moderate`, { action: 'reject' })
      if (result.code === 2000) {
        fetchComments()
      }
    } catch {
      setError('审核操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？')) return

    try {
      const result = await api.delete(`/comments/${id}`)
      if (result.code === 2000) {
        fetchComments()
      }
    } catch {
      setError('删除评论失败')
    }
  }

  const handleBatchApprove = async () => {
    if (selectedComments.size === 0) return

    try {
      const promises = Array.from(selectedComments).map(id =>
        api.put(`/comments/${id}/moderate`, { action: 'approve' })
      )
      await Promise.all(promises)
      setSelectedComments(new Set())
      fetchComments()
    } catch {
      setError('批量审核失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedComments.size === 0) return
    if (!confirm(`确定要删除选中的 ${selectedComments.size} 条评论吗？`)) return

    try {
      const promises = Array.from(selectedComments).map(id =>
        api.delete(`/comments/${id}`)
      )
      await Promise.all(promises)
      setSelectedComments(new Set())
      fetchComments()
    } catch {
      setError('批量删除失败')
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedComments)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedComments(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedComments.size === comments.length) {
      setSelectedComments(new Set())
    } else {
      setSelectedComments(new Set(comments.map(c => c.id)))
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    const labels = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已拒绝',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  const maskIp = (ip?: string) => {
    if (!ip) return '-'
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`
    }
    return ip
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
          <h1 className="text-2xl font-bold">评论管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            审核和管理用户评论
          </p>
        </div>

        {/* Batch Actions */}
        {selectedComments.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleBatchApprove}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              批量通过 ({selectedComments.size})
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              批量删除
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 p-1 bg-sidebar rounded-lg w-fit">
        {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setPage(1)
            }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f
                ? 'bg-background shadow-sm font-medium'
                : 'hover:bg-background/50'
            }`}
          >
            {f === 'all' ? '全部' : f === 'PENDING' ? '待审核' : f === 'APPROVED' ? '已通过' : '已拒绝'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedComments.size === comments.length && comments.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">内容</th>
              <th className="px-4 py-3 text-left text-sm font-medium">用户</th>
              <th className="px-4 py-3 text-left text-sm font-medium">文章</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium">IP</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  暂无评论
                </td>
              </tr>
            ) : (
              comments.map((comment) => (
                <tr key={comment.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedComments.has(comment.id)}
                      onChange={() => toggleSelect(comment.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm line-clamp-2">{comment.content}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p className="font-medium">{comment.nickname}</p>
                      {comment.email && (
                        <p className="text-muted-foreground text-xs">{comment.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {comment.post ? (
                      <Link
                        href={`/admin/posts/${comment.post.id}`}
                        className="text-sm text-primary hover:underline line-clamp-1"
                      >
                        {comment.post.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(comment.status)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm font-mono">
                    {maskIp(comment.ip)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {comment.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(comment.id)}
                          className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReject(comment.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          拒绝
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
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
