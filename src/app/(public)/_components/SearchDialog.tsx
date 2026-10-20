'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !open) {
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
          className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[70] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-border bg-background p-2 text-text-main shadow-2xl outline-none ring-4 ring-background sm:top-[10vh]"
          onOpenAutoFocus={event => {
            event.preventDefault()
            inputRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
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
            输入搜索关键词，按 Esc 或点击背景关闭搜索。
          </Dialog.Description>
          <div className="flex items-center gap-3 rounded-xl border border-border px-3 transition-colors focus-within:border-primary">
            <Search size={20} className="shrink-0 text-text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              aria-label="搜索关键词"
              placeholder="搜索文章..."
              autoComplete="off"
              spellCheck={false}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-text-main outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
            />
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
