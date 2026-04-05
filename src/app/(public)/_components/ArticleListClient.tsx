/**
 * ArticleListClient - 客户端文章列表组件
 * 负责：客户端状态管理（视图切换）、分页请求
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArticleCard, type Post } from './ArticleCard'
import { Pagination } from './Pagination'
import { LayoutGrid, List } from 'lucide-react'

interface ArticleListClientProps {
  initialPosts: Post[]
  initialPage: number
  initialTotalPages: number
  initialTotal: number
}

function ArticleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4">
      <div className="aspect-video w-full rounded-md bg-muted" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-muted" />
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>
      <div className="mt-3 h-6 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-6 w-1/2 rounded bg-muted" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="flex gap-3">
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function ArticleListClient({
  initialPosts,
  initialPage,
  initialTotalPages,
}: ArticleListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [posts, setPosts] = useState(initialPosts)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const handlePageChange = async (newPage: number) => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(newPage))

        const response = await fetch(`/api/posts?${params.toString()}`)
        const result = await response.json()

        if (result.success && result.data) {
          setPosts(result.data)
          setPage(result.page)
          setTotalPages(result.totalPages)

          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            aria-label="网格视图"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            aria-label="列表视图"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Article Grid/List */}
      <div
        className={
          viewMode === 'grid'
            ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col gap-4'
        }
      >
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))
          : posts.map((post) => <ArticleCard key={post.id} post={post} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            current={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
