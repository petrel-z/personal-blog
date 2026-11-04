'use client'

import { useEffect, useState } from 'react'

/** Cancel superseded requests so a slower previous period never overwrites the selected one. */
export function useAdminQuery<T>(endpoint: string, params: Record<string, string | number> = {}, enabled = true) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()
  const url = `/api${endpoint}${query ? `?${query}` : ''}`
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState({ data: null, loading: true, error: null })
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        const result = await response.json()
        if (!response.ok || result.code !== 2000 || result.data == null) throw new Error(result.message || '获取数据失败，请重试')
        if (!controller.signal.aborted) setState({ data: result.data, loading: false, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error: error instanceof Error ? error.message : '网络异常，请重试' })
      }
    }
    void load()
    return () => controller.abort()
  }, [url, enabled, attempt])
  return { ...state, retry: () => setAttempt(value => value + 1) }
}
