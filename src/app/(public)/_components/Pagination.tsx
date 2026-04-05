/**
 * Pagination - 分页组件
 * 支持：上一页/下一页、页码跳转、省略号
 */

'use client'

import { useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  current: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ current, totalPages, onPageChange }: PaginationProps) {
  // No pagination needed if only 1 page
  if (totalPages <= 1) return null

  // Generate page numbers with ellipsis
  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = []
    const delta = 1 // Pages to show on each side of current

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= current - delta && i <= current + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis')
      }
    }

    return pages
  }, [current, totalPages])

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="分页导航"
    >
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(current - 1)}
        disabled={current === 1}
        className="flex h-9 w-9 items-center justify-center rounded-md border text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
        aria-label="上一页"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-3 text-sm transition-colors ${
              page === current
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
            aria-current={page === current ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(current + 1)}
        disabled={current === totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-md border text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
        aria-label="下一页"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
