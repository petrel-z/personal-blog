/**
 * ArticleList - 文章列表组件
 * 支持：网格/列表切换、loading骨架屏、空状态
 */

'use client'

import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { ArticleCard, type Post } from './ArticleCard'
import { Pagination } from './Pagination'

interface ArticleListProps {
  posts: Post[]
  loading?: boolean
  empty?: string
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

function ArticleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4">
      {/* Image skeleton */}
      <div className="aspect-video w-full rounded-md bg-muted" />

      {/* Category/Tags skeleton */}
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-muted" />
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>

      {/* Title skeleton */}
      <div className="mt-3 h-6 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-6 w-1/2 rounded bg-muted" />

      {/* Summary skeleton */}
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>

      {/* Footer skeleton */}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">📭</div>
      <h3 className="text-lg font-medium text-foreground">暂无文章</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function ArticleList({
  posts,
  loading = false,
  empty = '这里还没有文章，敬请期待...',
  page = 1,
  totalPages = 1,
  onPageChange,
}: ArticleListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Loading state - show skeletons
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (!loading && posts.length === 0) {
    return <EmptyState message={empty} />
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
            aria-pressed={viewMode === 'grid'}
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
            aria-pressed={viewMode === 'list'}
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
        {posts.map((post) => (
          <ArticleCard key={post.id} post={post} />
        ))}
      </div>

      {/* Pagination */}
      {onPageChange && totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            current={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}
