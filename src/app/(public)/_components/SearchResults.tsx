'use client'

import { FileText, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { SearchState } from '@/client/hooks/useArticleSearch'
import { splitSearchHighlight } from '@/shared/search-highlight'
import { cn } from '@/lib/utils'

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  return <>{splitSearchHighlight(text, keyword).map((part, index) => part.matched
    ? <mark key={index} className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-400/25">{part.text}</mark>
    : part.text)}</>
}

const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm text-text-main transition-colors hover:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60'

export function SearchResults({ state, listId, activeId, retryAfter, onRetry, onLoadMore, onNavigate }: {
  state: SearchState
  listId: string
  activeId?: string
  retryAfter: number
  onRetry: () => void
  onLoadMore: () => void
  onNavigate: () => void
}) {
  const regionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const region = regionRef.current
    const active = activeId ? document.getElementById(activeId) : null
    if (!region || !active) return
    // Scroll only the results, keeping the input and background reading position fixed.
    const bounds = region.getBoundingClientRect()
    const itemBounds = active.getBoundingClientRect()
    if (itemBounds.top < bounds.top || itemBounds.height > region.clientHeight) {
      region.scrollTop += itemBounds.top - bounds.top
    } else if (itemBounds.bottom > bounds.bottom) {
      region.scrollTop += itemBounds.bottom - bounds.bottom
    }
  }, [activeId])

  if (state.status === 'idle' || state.status === 'waiting' || (state.status === 'error' && !state.retryable)) return null
  const loading = state.status === 'loading' || (state.status === 'success' && state.moreStatus === 'loading')

  return (
    <section
      ref={regionRef}
      aria-label="搜索内容"
      aria-busy={loading}
      className="mt-2 min-h-0 overflow-y-auto overscroll-contain rounded-lg border-t border-border"
    >
      {state.status === 'loading' && (
        <div aria-hidden="true" className="space-y-5 px-3 py-4 motion-safe:animate-pulse">
          {[0, 1, 2].map(index => <div key={index} className="space-y-2">
            <div className="h-4 w-2/3 rounded bg-sidebar-active" />
            <div className="h-3 w-full rounded bg-sidebar" />
          </div>)}
        </div>
      )}
      {(state.status === 'error' || state.status === 'rateLimited') && (
        <div className="px-3 py-4">
          <button type="button" className={actionClass} onClick={onRetry} disabled={retryAfter > 0}>
            {retryAfter > 0 ? `${retryAfter} 秒后重试` : '重新搜索'}
          </button>
        </div>
      )}
      {state.status === 'success' && (
        state.data.items.length === 0
          ? <p className="px-3 py-5 text-sm text-text-muted">试试文章标题、正文或标签中的词语。</p>
          : <>
            <ul id={listId} role="listbox" aria-label="搜索结果" className="divide-y divide-border">
              {state.data.items.map(item => (
                <li key={item.id} role="presentation">
                  <Link
                    id={`${listId}-${item.id}`}
                    href={`/post/${encodeURIComponent(item.id)}`}
                    prefetch={false}
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeId === `${listId}-${item.id}`}
                    aria-labelledby={`${listId}-${item.id}-title`}
                    aria-describedby={`${listId}-${item.id}-excerpt`}
                    onClick={event => {
                      if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                        onNavigate()
                      }
                    }}
                    className={cn(
                      'flex gap-3 px-3 py-4 transition-colors hover:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                      activeId === `${listId}-${item.id}` && 'bg-primary/10 ring-1 ring-inset ring-primary',
                    )}
                  >
                    <FileText size={18} className="mt-1 hidden shrink-0 text-text-muted sm:block" aria-hidden="true" />
                    <div className="min-w-0 flex-1 space-y-2 [overflow-wrap:anywhere]">
                      <h3 id={`${listId}-${item.id}-title`} className="text-base font-medium leading-6 text-text-main">
                        <HighlightedText text={item.title} keyword={state.keyword} />
                      </h3>
                      <p id={`${listId}-${item.id}-excerpt`} className="text-sm leading-6 text-text-muted">
                        <HighlightedText text={item.excerpt || '暂无摘要'} keyword={state.keyword} />
                      </p>
                      {(item.category || item.tags.length > 0) && (
                        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                          {item.category && <span>{item.category.name}</span>}
                          {item.tags.map(tag => <span key={tag.id} className="rounded bg-sidebar px-1.5 py-0.5">
                            <HighlightedText text={tag.name} keyword={state.keyword} />
                          </span>)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-3 py-3 text-center">
              {state.moreStatus === 'error' && <p role="alert" className="mb-2 text-sm text-text-muted">加载更多失败，已显示的文章已保留。</p>}
              {state.moreStatus === 'rateLimited' && <p role="alert" className="mb-2 text-sm text-text-muted">
                {retryAfter > 0 ? `搜索过于频繁，请 ${retryAfter} 秒后重试。` : '现在可以继续加载。'}已显示的文章已保留。
              </p>}
              {state.data.page < state.data.totalPages
                ? <button type="button" className={actionClass} onClick={onLoadMore} disabled={loading || retryAfter > 0}>
                  {loading && <Loader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" />}
                  {loading ? '加载中…' : retryAfter > 0 ? `${retryAfter} 秒后重试`
                    : state.moreStatus === 'error' || state.moreStatus === 'rateLimited' ? '重试加载' : '加载更多'}
                </button>
                : <p className="text-xs text-text-muted">没有更多结果</p>}
            </div>
          </>
      )}
    </section>
  )
}
