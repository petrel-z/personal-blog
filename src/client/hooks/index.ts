'use client'

import { useState, useCallback } from 'react'

export function useDebounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
) {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      const id = setTimeout(() => {
        fn(...args)
      }, delay)
      setTimeoutId(id)
    },
    [fn, delay, timeoutId]
  )
}
