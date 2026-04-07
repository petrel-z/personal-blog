'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { PostWithRelations } from '@/shared/types'

export default function PostsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [posts, setPosts] = useState<PostWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<'all' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('all')
  const [search, setSearch] = useState('')

  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true)
      const params: Record<string, string | number> = { page, pageSize: 10 }
      if (filter !== 'all') {
        params.status = filter
      }

      const result = await api.get('/posts', params) as { code: number; data: { items: PostWithRelations[]; total: number; totalPages: number }; message: string }

      if (result.code === 2000 && result.data) {
        // Filter by search if needed (client-side for simplicity)
        let filteredPosts = result.data.items || []
        if (search) {
          filteredPosts = filteredPosts.filter(p =>
            p.title.toLowerCase().includes(search.toLowerCase())
          )
        }
        setPosts(filteredPosts)
        setTotal(result.data.total ?? 0)
        setTotalPages(result.data.totalPages || 1)
      }
    } catch {
      setError('获取文章列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [page, filter, search])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchPosts()
  }, [isAuthenticated, authLoading, fetchPosts])

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return

    try {
      const result = await api.delete(`/posts/${id}`)
      if (result.code === 2000) {
        fetchPosts()
      }
    } catch {
      setError('删除文章失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PUBLISHED: 'bg-green-100 text-green-700',
      DRAFT: 'bg-yellow-100 text-yellow-700',
      ARCHIVED: 'bg-gray-100 text-gray-700',
      DELETED: 'bg-red-100 text-red-700',
    }
    const labels = {
      PUBLISHED: '已发布',
      DRAFT: '草稿',
      ARCHIVED: '归档',
      DELETED: '已删除',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles] || styles.DRAFT}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
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
          <h1 className="text-2xl font-bold">文章管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            共 {total} 篇文章
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          写文章
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="搜索文章标题..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 p-1 bg-sidebar rounded-lg">
          {(['all', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((f) => (
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
              {f === 'all' ? '全部' : f === 'PUBLISHED' ? '已发布' : f === 'DRAFT' ? '草稿' : '归档'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
              <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">阅读量</th>
              <th className="px-4 py-3 text-left text-sm font-medium">评论数</th>
              <th className="px-4 py-3 text-left text-sm font-medium">发布时间</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  暂无文章
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {post.title}
                    </Link>
                    <div className="flex gap-1 mt-1">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id} className="text-xs px-1.5 py-0.5 bg-sidebar rounded text-muted-foreground">
                          {tag.name}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{post.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {post.category?.name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(post.status)}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {post.viewCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {post.commentCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('zh-CN')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
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
