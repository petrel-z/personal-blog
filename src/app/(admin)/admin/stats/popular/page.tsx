'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import { useAuth } from '../../../_components'
import type { PostWithRelations } from '@/shared/types'

export default function StatsPopularPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [posts, setPosts] = useState<PostWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchPopularPosts()
  }, [isAuthenticated, authLoading, period])

  const fetchPopularPosts = async () => {
    try {
      setIsLoading(true)
      const result = await api.get<PostWithRelations[]>('/stats/popular', { period })
      if (result.success && result.data) {
        setPosts(result.data)
      }
    } catch {
      console.error('Failed to fetch popular posts')
    } finally {
      setIsLoading(false)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">热门文章</h1>
          <p className="text-sm text-muted-foreground mt-1">
            按阅读量排序的文章列表
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1 p-1 bg-sidebar rounded-lg">
          {(['7d', '30d', '90d', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? 'bg-background shadow-sm font-medium'
                  : 'hover:bg-background/50'
              }`}
            >
              {p === '7d' ? '7天' : p === '30d' ? '30天' : p === '90d' ? '90天' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Posts List */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium w-12">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
              <th className="px-4 py-3 text-right text-sm font-medium">阅读量</th>
              <th className="px-4 py-3 text-right text-sm font-medium">点赞数</th>
              <th className="px-4 py-3 text-right text-sm font-medium">评论数</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              posts.map((post, index) => (
                <tr key={post.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      index < 3 ? 'bg-primary/10 text-primary' : 'bg-sidebar'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {post.title}
                    </Link>
                    {post.category && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        / {post.category.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {post.viewCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {post.likeCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {post.commentCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
