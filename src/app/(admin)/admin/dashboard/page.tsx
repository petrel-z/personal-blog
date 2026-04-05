'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { PostWithRelations } from '@/shared/types'

interface OverviewStats {
  postCount: number
  commentCount: number
  totalViews: number
  totalLikes: number
}

interface RecentComment {
  id: string
  content: string
  nickname: string
  status: string
  createdAt: string
  post?: {
    id: string
    title: string
  }
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [popularPosts, setPopularPosts] = useState<PostWithRelations[]>([])
  const [recentComments, setRecentComments] = useState<RecentComment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchDashboardData()
  }, [isAuthenticated, authLoading])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)

      // Fetch all data in parallel
      const [statsResult, popularResult, commentsResult] = await Promise.all([
        api.get<OverviewStats>('/stats'),
        api.get<PostWithRelations[]>('/stats', { type: 'popular', timeframe: 'week' }),
        api.get<RecentComment[]>('/comments/admin', { pageSize: 5 }),
      ])

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }
      if (popularResult.success && popularResult.data) {
        setPopularPosts(popularResult.data.slice(0, 5))
      }
      if (commentsResult.success && commentsResult.data) {
        setRecentComments(commentsResult.data)
      }
    } catch {
      console.error('Failed to fetch dashboard data')
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          欢迎回来！以下是博客的总体情况。
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">文章总数</p>
              <p className="text-2xl font-bold">{stats?.postCount || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">评论总数</p>
              <p className="text-2xl font-bold">{stats?.commentCount || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总阅读量</p>
              <p className="text-2xl font-bold">{(stats?.totalViews || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总点赞数</p>
              <p className="text-2xl font-bold">{(stats?.totalLikes || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Popular Posts */}
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-medium">热门文章</h2>
            <Link href="/admin/stats/popular" className="text-sm text-primary hover:underline">
              查看全部
            </Link>
          </div>
          <div className="divide-y">
            {popularPosts.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                暂无数据
              </div>
            ) : (
              popularPosts.map((post) => (
                <div key={post.id} className="px-4 py-3 hover:bg-accent/50">
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {post.title}
                  </Link>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{post.viewCount.toLocaleString()} 阅读</span>
                    <span>{post.likeCount.toLocaleString()} 点赞</span>
                    <span>{post.commentCount.toLocaleString()} 评论</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Comments */}
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-medium">最新评论</h2>
            <Link href="/admin/comments" className="text-sm text-primary hover:underline">
              查看全部
            </Link>
          </div>
          <div className="divide-y">
            {recentComments.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                暂无数据
              </div>
            ) : (
              recentComments.map((comment) => (
                <div key={comment.id} className="px-4 py-3 hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm line-clamp-2">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.nickname} · {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      comment.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : comment.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {comment.status === 'APPROVED' ? '已通过' : comment.status === 'PENDING' ? '待审核' : '已拒绝'}
                    </span>
                  </div>
                  {comment.post && (
                    <Link
                      href={`/admin/posts/${comment.post.id}`}
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      来自：{comment.post.title}
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border rounded-lg bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">快捷操作</h2>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/posts/new"
            className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </div>
            <div>
              <p className="font-medium">写文章</p>
              <p className="text-xs text-muted-foreground">创建新文章</p>
            </div>
          </Link>

          <Link
            href="/admin/posts"
            className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <p className="font-medium">文章管理</p>
              <p className="text-xs text-muted-foreground">编辑或删除文章</p>
            </div>
          </Link>

          <Link
            href="/admin/comments"
            className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">评论审核</p>
              <p className="text-xs text-muted-foreground">查看待审核评论</p>
            </div>
          </Link>

          <Link
            href="/admin/settings"
            className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="font-medium">系统设置</p>
              <p className="text-xs text-muted-foreground">配置博客选项</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
