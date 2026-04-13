/**
 * Homepage - 首页
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { api } from '@/client/api'
import type { PostWithRelations } from '@/shared/types'
import { RightWidgets } from './_components/RightWidgets'
import { cn } from '@/lib/utils'
import { formatDate } from '@/shared/utils'

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [articles, setArticles] = useState<PostWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [featuredPost, setFeaturedPost] = useState<PostWithRelations | null>(null)

  const fetchArticles = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/posts', { page: currentPage, pageSize: 10, status: 'PUBLISHED' }) as unknown as { code: number; data: { items: PostWithRelations[]; total: number; totalPages: number }; message: string }

      if (result.code === 2000 && result.data) {
        setArticles(result.data.items || [])
        setTotalPages(result.data.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage])

  // Always use first article as featured if available
  useEffect(() => {
    const abortController = new AbortController()
    fetchArticles()
    return () => abortController.abort()
  }, [fetchArticles])

  useEffect(() => {
    if (articles.length > 0) {
      const pinned = articles.find((p) => p.isPinned === true)
      setFeaturedPost(pinned || articles[0])
    }
  }, [articles])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 flex gap-6 max-w-7xl mx-auto"
    >
      {/* Article List */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Featured Banner - Always show, with placeholder when no article */}
        <div className="relative h-44 sm:h-56 overflow-hidden group border-b border-border">
          <Image
            src={featuredPost?.coverImage || 'https://picsum.photos/seed/banner/1200/600'}
            alt={featuredPost?.title || '博客封面'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-8">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-4 text-xs text-gray-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {featuredPost?.isPinned ? '置顶' : '最新文章'}
                </span>
                <span>{featuredPost ? formatDate(featuredPost.publishedAt) : ''}</span>
              </div>
              {featuredPost ? (
                <Link href={`/post/${featuredPost.id}`}>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight group-hover:text-primary transition-colors">
                    {featuredPost.title}
                  </h1>
                </Link>
              ) : (
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  欢迎访问博客
                </h1>
              )}
              <p className="text-gray-200 text-sm sm:text-base line-clamp-2">
                {featuredPost?.summary || '这里还没有文章，敬请期待...'}
              </p>
            </div>
          </div>

          {/* Banner Controls */}
          <div className="absolute bottom-8 right-8 flex gap-2">
            <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Article List */}
        <div className="space-y-0">
          {isLoading ? (
            <div className="text-center py-16 text-text-muted">加载中...</div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 text-text-muted">暂无文章</div>
          ) : (
            articles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ArticleCard article={article} />
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-text-muted disabled:hover:border-border transition-all"
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-10 h-10 rounded-lg border transition-all text-sm font-medium',
                    currentPage === page
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-card border-border text-text-muted hover:text-primary hover:border-primary'
                  )}
                >
                  {page}
                </button>
              )
            })}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-text-muted disabled:hover:border-border transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex-shrink-0 hidden xl:block border-l border-border">
        <RightWidgets />
      </div>
    </motion.div>
  )
}

function ArticleCard({ article }: { article: PostWithRelations }) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <article className="border-b border-border overflow-hidden hover:bg-sidebar-active/30 transition-colors group">
      <div className="flex flex-col md:flex-row gap-4 py-4">
        {/* Cover Image */}
        {article.coverImage && (
          <Link
            href={`/post/${article.id}`}
            className="w-full md:w-36 h-24 flex-shrink-0 rounded overflow-hidden relative group-hover:opacity-90 transition-opacity"
          >
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              className="object-cover"
              referrerPolicy="no-referrer"
            />
            {(article as any).isPinned && (
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                置顶
              </div>
            )}
          </Link>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between space-y-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {article.category?.name || '未分类'}
              </span>
              <div className="flex gap-2">
                {article.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[10px] text-text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>

            <Link href={`/post/${article.id}`}>
              <h2 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors leading-tight">
                {article.title}
              </h2>
            </Link>

            <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span>{article.author?.name || '匿名'}</span>
              <span>发布于 {formatDate(article.publishedAt)}</span>
              {article.createdAt && article.createdAt !== article.publishedAt && (
                <span>创建于 {formatDate(article.createdAt)}</span>
              )}
              <span>{article.commentCount} 评论</span>
              <span>{article.viewCount} 阅读</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
