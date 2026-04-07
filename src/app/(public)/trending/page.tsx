'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import type { PostWithRelations } from '@/shared/types'
import { Activity, Eye, ThumbsUp, MessageSquare } from 'lucide-react'

export default function TrendingPage() {
  const [posts, setPosts] = useState<PostWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTrendingPosts()
  }, [])

  const fetchTrendingPosts = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/stats', { type: 'popular', timeframe: 'all' }) as unknown as { code: number; data: { items: PostWithRelations[] }; message: string }

      if (result.code === 2000 && result.data) {
        setPosts(result.data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch trending posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="text-primary" size={28} />
        <h1 className="text-3xl font-bold">热度排行榜</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">加载中...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">暂无数据</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 hover:bg-sidebar-active/30 transition-all group"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                index < 3 ? 'bg-primary/10 text-primary' : 'bg-sidebar'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                  {post.title}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {post.viewCount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={12} />
                    {post.likeCount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={12} />
                    {post.commentCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
