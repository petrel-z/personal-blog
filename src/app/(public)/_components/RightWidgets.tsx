/**
 * RightWidgets - 右侧边栏组件
 * 包含：热门文章、博客信息、标签云
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, MessageSquare, Calendar, Activity, Tag } from 'lucide-react'
import { api } from '@/client/api'
import type { PostWithRelations } from '@/shared/types'

interface OverviewStats {
  postCount: number
  commentCount: number
  totalViews: number
  totalLikes: number
}

interface TagItem {
  id: string
  name: string
  slug: string
}

export function RightWidgets() {
  const [hotPosts, setHotPosts] = useState<PostWithRelations[]>([])
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [tags, setTags] = useState<TagItem[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch hot posts, stats, and tags in parallel
      const [postsResult, statsResult, tagsResult] = await Promise.all([
        api.get('/stats', { type: 'popular', timeframe: 'week' }) as unknown as { code: number; data: { items: PostWithRelations[] }; message: string },
        api.get('/stats') as unknown as { code: number; data: OverviewStats; message: string },
        api.get('/tags') as unknown as { code: number; data: { items: TagItem[] }; message: string },
      ])

      if (postsResult.code === 2000) {
        setHotPosts(postsResult.data?.items?.slice(0, 3) || [])
      }
      if (statsResult.code === 2000) {
        setStats(statsResult.data)
      }
      if (tagsResult.code === 2000) {
        setTags(tagsResult.data?.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch widget data:', error)
    }
  }

  // Calculate running days (hardcoded start date)
  const runningDays = () => {
    const startDate = new Date('2018-01-01')
    const today = new Date()
    const diff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const years = Math.floor(diff / 365)
    const days = diff % 365
    return `${years}年${days}天`
  }

  return (
    <aside className="w-80 flex-shrink-0 hidden xl:block h-full border-l border-border">
      <div className="space-y-4 p-3">
        {/* Hot Articles */}
        <div className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-bold text-sm text-text-muted flex items-center gap-2">
            <Activity size={16} />
            热门文章
          </div>
          <ul className="divide-y divide-border">
            {hotPosts.length > 0 ? (
              hotPosts.slice(0, 3).map((article) => (
                <li
                  key={article.id}
                  className="p-2 hover:bg-sidebar-active/30 transition-colors group"
                >
                  <Link
                    href={`/post/${article.id}`}
                    className="flex gap-2"
                  >
                    <img
                      src={article.coverImage || 'https://picsum.photos/seed/default/100/100'}
                      alt={article.title}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        <Eye size={10} />
                        {article.viewCount.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            ) : (
              <li className="p-4 text-center text-xs text-text-muted">暂无数据</li>
            )}
          </ul>
        </div>

        {/* Blog Info */}
        <div className="p-2 space-y-3 border-t border-border">
          <h3 className="text-sm font-bold text-text-muted">博客信息</h3>
          <ul className="space-y-2">
            <li className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <Activity size={14} />
                文章数目
              </div>
              <span className="bg-sidebar-active/20 dark:bg-sidebar-active/10 px-2 py-0.5 rounded text-text-muted">
                {stats?.postCount ?? 0}
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <MessageSquare size={14} />
                评论数目
              </div>
              <span className="bg-sidebar-active/20 dark:bg-sidebar-active/10 px-2 py-0.5 rounded text-text-muted">
                {stats?.commentCount ?? 0}
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <Calendar size={14} />
                运行天数
              </div>
              <span className="bg-sidebar-active/20 dark:bg-sidebar-active/10 px-2 py-0.5 rounded text-text-muted">
                {runningDays()}
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <Activity size={14} />
                最后活动
              </div>
              <span className="bg-sidebar-active/20 dark:bg-sidebar-active/10 px-2 py-0.5 rounded text-text-muted">
                1天前
              </span>
            </li>
          </ul>
        </div>

        {/* Tag Cloud */}
        <div className="p-2 space-y-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-bold text-text-muted">
            <Tag size={16} />
            标签云
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length > 0 ? (
              tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="text-[10px] px-2 py-1 bg-sidebar-active/20 dark:bg-sidebar-active/10 text-text-muted rounded hover:bg-primary hover:text-white transition-colors"
                >
                  {tag.name}
                </Link>
              ))
            ) : (
              <span className="text-xs text-text-muted">暂无标签</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
