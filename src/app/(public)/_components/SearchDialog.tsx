'use client'

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useArticleSearch } from '@/client/hooks/useArticleSearch'

const SearchResults = dynamic(() => import('./SearchResults').then(module => module.SearchResults), { ssr: false })

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const navigatingRef = useRef(false)
  const pathname = usePathname()
  const previousPathRef = useRef(pathname)

  const closeForNavigation = useCallback(() => {
    navigatingRef.current = true
    setOpen(false)
  }, [])

  useEffect(() => {
    if (previousPathRef.current !== pathname && open) closeForNavigation()
    previousPathRef.current = pathname
  }, [pathname, open, closeForNavigation])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !open) {
      navigatingRef.current = false
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    }
    setOpen(nextOpen)
  }, [open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented || event.isComposing || event.repeat ||
        event.altKey || event.shiftKey ||
        !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k'
      ) return

      event.preventDefault()
      handleOpenChange(true)
      inputRef.current?.focus({ preventScroll: true })
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="搜索文章"
          aria-keyshortcuts="Control+k Meta+k"
          className="flex min-w-0 flex-1 max-w-md items-center gap-2 rounded border border-border bg-sidebar px-3 py-2 text-left text-xs text-text-muted transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-3"
        >
          <Search size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">搜索文章...</span>
          <kbd aria-hidden="true" className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-[10px] sm:block">
            Ctrl / ⌘ K
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[70] flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 flex-col rounded-2xl border border-border bg-background p-2 text-text-main shadow-2xl outline-none ring-4 ring-background sm:top-[10vh] sm:max-h-[80dvh]"
          onOpenAutoFocus={event => {
            event.preventDefault()
            inputRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
            // Let the destination page manage focus when following a result.
            if (navigatingRef.current) return
            const previousFocus = previousFocusRef.current
            const target = previousFocus?.isConnected && previousFocus !== document.body
              ? previousFocus
              : triggerRef.current
            target?.focus({ preventScroll: true })
          }}
          onEscapeKeyDown={event => {
            if (event.isComposing) event.preventDefault()
          }}
        >
          <Dialog.Title className="sr-only">搜索文章</Dialog.Title>
          <Dialog.Description className="sr-only">
            输入关键词后自动搜索，按 Enter 立即搜索。用上下方向键选择结果，再按 Enter 打开文章。按 Esc 或点击背景关闭搜索。
          </Dialog.Description>
          <SearchInput inputRef={inputRef} onNavigate={closeForNavigation} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SearchInput({ inputRef, onNavigate }: { inputRef: RefObject<HTMLInputElement>; onNavigate: () => void }) {
  const search = useArticleSearch()
  const statusId = useId()
  const resultsId = useId()
  const helpId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { state } = search
  const items = state.status === 'success' ? state.data.items : []
  const selectedIndex = items.findIndex(item => item.id === selectedId)
  const activeDescendant = selectedIndex >= 0 ? `${resultsId}-${items[selectedIndex].id}` : undefined
  const hasResults = items.length > 0
  const statusText = state.status === 'success'
    ? state.data.total > 0 ? `找到 ${state.data.total} 篇相关文章` : '没有找到相关文章，换个关键词试试'
    : state.status === 'error' ? state.message
    : state.status === 'loading' ? '正在搜索…'
    : state.status === 'waiting' ? '输入完成后自动搜索，按 Enter 立即搜索'
    : '输入关键词搜索文章'

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 transition-colors focus-within:border-primary sm:gap-3">
        <Search size={20} className="shrink-0 text-text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="搜索关键词"
          aria-describedby={`${statusId} ${helpId}`}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={hasResults}
          aria-controls={hasResults ? resultsId : undefined}
          aria-activedescendant={activeDescendant}
          placeholder="搜索文章..."
          autoComplete="off"
          spellCheck={false}
          value={search.value}
          onChange={event => {
            setSelectedId(null)
            search.change(event.currentTarget.value)
          }}
          onCompositionStart={() => {
            setSelectedId(null)
            search.startComposition()
          }}
          onCompositionEnd={event => search.endComposition(event.currentTarget.value)}
          onKeyDown={event => {
            if (
              event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
              event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
            ) return
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasResults) {
              event.preventDefault()
              const nextIndex = selectedIndex < 0
                ? event.key === 'ArrowDown' ? 0 : items.length - 1
                : Math.max(0, Math.min(items.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
              setSelectedId(items[nextIndex].id)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              // Use the same real link for pointer and keyboard navigation.
              if (activeDescendant) document.getElementById(activeDescendant)?.click()
              else search.submit()
            }
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-text-main outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {search.value && (
          <button
            type="button"
            aria-label="清空关键词"
            onClick={() => {
              setSelectedId(null)
              search.clear()
              inputRef.current?.focus({ preventScroll: true })
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true" className="text-xs">清空</span>
          </button>
        )}
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="关闭搜索"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true" className="hidden rounded border border-border px-1.5 py-0.5 text-xs sm:block">Esc</span>
            <X size={18} aria-hidden="true" className="sm:hidden" />
          </button>
        </Dialog.Close>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-1 pt-3 text-sm text-text-muted">
        <p id={statusId} role="status" aria-atomic="true">{statusText}</p>
        <p id={helpId} className={hasResults ? 'text-xs' : 'sr-only'}>↑↓ 选择 · Enter 打开</p>
      </div>
      <SearchResults
        state={state} listId={resultsId} activeId={activeDescendant}
        onRetry={search.submit} onLoadMore={search.loadMore} onNavigate={onNavigate}
      />
    </>
  )
}
