import type { Page } from '@playwright/test'
import type { SearchResultItem } from '../../src/shared/types/search'

export function article(id: number, overrides: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    id: `post-${id}`, title: `权限文章 ${id}`, slug: `post-${id}`,
    excerpt: `介绍接口权限的实现 ${id}。`, coverImage: null, publishedAt: '2026-10-20T00:00:00.000Z',
    category: { id: 'category-1', name: '开发', slug: 'development' },
    tags: [{ id: 'tag-1', name: '权限', slug: 'permission' }],
    ...overrides,
  }
}

export function searchResponse(items: SearchResultItem[], total = items.length, page = 1) {
  return { code: 2000, message: 'success', timestamp: 0,
    data: { items, total, page, pageSize: 10, totalPages: Math.ceil(total / 10) } }
}

export function result(total: number) {
  return searchResponse(Array.from({ length: Math.min(total, 10) }, (_, index) => article(index + 1)), total)
}

// Ignore abort at the fetch boundary to test responses that arrive after cancellation.
declare global {
  interface Window {
    pendingSearches: {
      keyword: string
      page: number
      signal: AbortSignal | null | undefined
      resolve: (body: unknown) => void
    }[]
  }
}

export async function deferSearch(page: Page) {
  await page.evaluate(() => {
    const originalFetch = window.fetch
    window.pendingSearches = []
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin)
      if (url.pathname !== '/api/search') return originalFetch(input, init)
      return new Promise<Response>(resolve => {
        window.pendingSearches.push({
          keyword: url.searchParams.get('keyword')!, page: Number(url.searchParams.get('page')),
          signal: init?.signal, resolve: body => resolve(Response.json(body)),
        })
      })
    }
  })
}

export async function respond(page: Page, index: number, body: unknown) {
  await page.evaluate(({ index, body }) => window.pendingSearches[index].resolve(body), { index, body })
}

export async function finishSearch(page: Page, index: number, total: number) {
  await respond(page, index, result(total))
}
