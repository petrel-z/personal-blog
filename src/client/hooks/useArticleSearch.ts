'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiCode } from '@/client/api/fetch'
import type { PaginatedData } from '@/lib/api-response'
import type { SearchResultItem } from '@/shared/types/search'

interface SearchSuccess {
  status: 'success'
  keyword: string
  data: PaginatedData<SearchResultItem>
  moreStatus: 'idle' | 'loading' | 'error' | 'rateLimited'
}

export type SearchState =
  | { status: 'idle' | 'waiting' | 'loading' | 'rateLimited' }
  | SearchSuccess
  | { status: 'error'; message: string; retryable: boolean }

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
  const retryAtRef = useRef(0)
  const [retryAt, setRetryAt] = useState(0)
  const [retryAfter, setRetryAfter] = useState(0)

  useEffect(() => {
    if (!retryAt) return
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
      setRetryAfter(remaining)
      if (!remaining) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [retryAt])

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

  const search = useCallback(async (keyword: string, previous?: SearchSuccess) => {
    if (Date.now() < retryAtRef.current) {
      setState(previous ? { ...previous, moreStatus: 'rateLimited' } : { status: 'rateLimited' })
      return
    }
    if (previous ? controllerRef.current !== null : submittedKeywordRef.current === keyword) return
    cancelPending()
    submittedKeywordRef.current = keyword
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = requestIdRef.current
    const isCurrent = () => !controller.signal.aborted && requestId === requestIdRef.current
    const page = previous ? previous.data.page + 1 : 1
    setState(previous ? { ...previous, moreStatus: 'loading' } : { status: 'loading' })

    try {
      const response = await api.get<SearchResultItem>('/search', {
        keyword, page, pageSize: 10,
      }, { signal: controller.signal })
      if (!isCurrent()) return

      if (response.code === ApiCode.RATE_LIMITED) {
        const seconds = response.retryAfterSeconds ?? 60
        retryAtRef.current = Date.now() + seconds * 1000
        setRetryAt(retryAtRef.current)
        setRetryAfter(seconds)
        submittedKeywordRef.current = null
        setState(previous ? { ...previous, moreStatus: 'rateLimited' } : { status: 'rateLimited' })
        return
      }

      const data = response.data
      if (
        response.code !== ApiCode.SUCCESS || !data || !('items' in data) ||
        !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        data.page !== page || data.pageSize !== 10 || data.totalPages !== Math.ceil(data.total / 10)
      ) throw new Error('Invalid search response')

      const items = previous ? [...previous.data.items] : []
      const seen = new Set(items.map(item => item.id))
      for (const item of data.items) {
        if (!seen.has(item.id)) {
          items.push(item)
          seen.add(item.id)
        }
      }
      setState({ status: 'success', keyword, data: { ...data, items }, moreStatus: 'idle' })
    } catch {
      if (!isCurrent()) return
      if (previous) {
        setState({ ...previous, moreStatus: 'error' })
      } else {
        submittedKeywordRef.current = null
        setState({ status: 'error', message: '搜索失败，请稍后按 Enter 重试', retryable: true })
      }
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
      setState({ status: 'error', message: '关键词最多为 100 个字符', retryable: false })
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
    if (Date.now() < retryAtRef.current) {
      setState({ status: 'rateLimited' })
      return
    }
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
    if (state.status === 'success' && state.keyword === keyword && state.moreStatus === 'rateLimited') {
      void search(keyword, state)
      return
    }
    if (validate(keyword)) void search(keyword)
  }, [search, validate, state])

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

  const loadMore = useCallback(() => {
    if (state.status !== 'success' || state.data.page >= state.data.totalPages) return
    void search(state.keyword, state)
  }, [search, state])

  return { value, state, retryAfter, change, submit, startComposition, endComposition, clear, loadMore }
}
