'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiCode } from '@/client/api/fetch'
import type { PaginatedData } from '@/lib/api-response'
import type { SearchResultItem } from '@/shared/types/search'

type SearchState =
  | { status: 'idle' | 'waiting' | 'loading' }
  | { status: 'success'; keyword: string; data: PaginatedData<SearchResultItem> }
  | { status: 'error'; message: string }

const SEARCH_DELAY = 500
const MAX_KEYWORD_LENGTH = 100

export function useArticleSearch() {
  const [value, setValue] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const valueRef = useRef('')
  const keywordRef = useRef('')
  const composingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const submittedKeywordRef = useRef<string | null>(null)

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    // Invalidate first: the API client also returns cancellations as error responses.
    requestIdRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    submittedKeywordRef.current = null
  }, [])

  // Mount this hook inside the dialog content so closing also resets its state.
  useEffect(() => cancelPending, [cancelPending])

  const search = useCallback(async (keyword: string) => {
    if (submittedKeywordRef.current === keyword) return
    cancelPending()
    submittedKeywordRef.current = keyword
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = requestIdRef.current
    const isCurrent = () => !controller.signal.aborted && requestId === requestIdRef.current
    setState({ status: 'loading' })

    try {
      const response = await api.get<SearchResultItem>('/search', {
        keyword, page: 1, pageSize: 10,
      }, { signal: controller.signal })
      if (!isCurrent()) return

      const data = response.data
      if (
        response.code !== ApiCode.SUCCESS || !data || !('items' in data) ||
        !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0
      ) throw new Error('Invalid search response')

      setState({ status: 'success', keyword, data })
    } catch {
      if (!isCurrent()) return
      submittedKeywordRef.current = null
      setState({ status: 'error', message: '搜索失败，请稍后按 Enter 重试' })
    } finally {
      if (isCurrent()) controllerRef.current = null
    }
  }, [cancelPending])

  const validate = useCallback((keyword: string) => {
    if (!keyword) {
      setState({ status: 'idle' })
      return false
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      setState({ status: 'error', message: '关键词最多为 100 个字符' })
      return false
    }
    return true
  }, [])

  const change = useCallback((nextValue: string) => {
    valueRef.current = nextValue
    setValue(nextValue)
    if (composingRef.current) return

    const keyword = nextValue.trim()
    if (keyword === keywordRef.current) return
    keywordRef.current = keyword
    // Cancel on input, before waiting for the next debounce, to prevent stale results.
    cancelPending()
    if (!validate(keyword)) return
    setState({ status: 'waiting' })
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void search(keyword)
    }, SEARCH_DELAY)
  }, [cancelPending, search, validate])

  const submit = useCallback(() => {
    if (composingRef.current) return
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    const keyword = valueRef.current.trim()
    if (validate(keyword)) void search(keyword)
  }, [search, validate])

  const startComposition = useCallback(() => {
    composingRef.current = true
    keywordRef.current = ''
    cancelPending()
    setState({ status: 'idle' })
  }, [cancelPending])

  const endComposition = useCallback((nextValue: string) => {
    composingRef.current = false
    change(nextValue)
  }, [change])

  const clear = useCallback(() => {
    composingRef.current = false
    valueRef.current = ''
    keywordRef.current = ''
    cancelPending()
    setValue('')
    setState({ status: 'idle' })
  }, [cancelPending])

  return { value, state, change, submit, startComposition, endComposition, clear }
}
