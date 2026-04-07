/**
 * CategoryPage - 分类文章列表页
 */

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/client/api'
import type { PostWithRelations } from '@/shared/types'
import { RightWidgets } from '../../_components/RightWidgets'
import { cn } from '@/lib/utils'

interface CategoryInfo {
  id: string
  name: string
  slug: string
  description?: string
  postCount?: number
}

export default function CategoryPage() {
  const params = useParams()
  const slug = params.slug as string

  const [category, setCategory] = useState<CategoryInfo | null>(null)
  const [articles, setArticles] = useState<PostWithRelations[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [slug, currentPage])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // Fetch category info first to get categoryId
      const categoriesResult = await api.get('/categories') as unknown as { code: number; data: CategoryInfo[]; message: string }

      if (categoriesResult.code === 2000 && categoriesResult.data) {
        // API returns data as array directly
        const categories = categoriesResult.data
        const cat = categories.find((c: CategoryInfo) => c.slug === slug)
        setCategory(cat || null)

        // Then fetch posts with categoryId
        if (cat?.id) {
          const postsResult = await api.get('/posts', { page: currentPage, pageSize: 9, categoryId: cat.id, status: 'PUBLISHED' }) as unknown as { code: number; data: { items: PostWithRelations[]; total: number; totalPages: number }; message: string }
          if (postsResult.code === 2000 && postsResult.data) {
            setArticles(postsResult.data.items || [])
            setTotalPages(postsResult.data.totalPages || 1)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch category data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="text-text-muted">加载中...</div>
      </div>
    )
  }

  // Category not found
  if (!category) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-text-main">分类不存在</h1>
        <Link href="/" className="text-primary hover:underline mt-4 block">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 flex gap-6 max-w-7xl mx-auto"
    >
      {/* Article List */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-main">{category?.name}</h1>
          {category?.description && (
            <p className="mt-2 text-sm text-text-muted">{category.description}</p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            共 {articles.length} 篇文章
          </p>
        </div>

        {/* Article List */}
        <div className="space-y-0">
          {isLoading ? (
            <div className="text-center py-16 text-text-muted">加载中...</div>
          ) : articles.length > 0 ? (
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
          ) : (
            <div className="text-center py-16">
              <p className="text-text-muted">该分类下暂无文章</p>
            </div>
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

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={cn(
                  'w-10 h-10 rounded-lg border transition-all text-sm font-medium',
                  currentPage === i + 1
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-card border-border text-text-muted hover:text-primary hover:border-primary'
                )}
              >
                {i + 1}
              </button>
            ))}

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
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
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
              <span>{formatDate(article.publishedAt)}</span>
              <span>{article.commentCount} 评论</span>
              <span>{article.viewCount} 阅读</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
