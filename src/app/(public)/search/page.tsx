/**
 * SearchPage - 搜索页
 */

'use client'

import { useState, useMemo, Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { Search as SearchIcon, X } from 'lucide-react'
import { api } from '@/client/api'
import type { PostWithRelations } from '@/shared/types'
import { RightWidgets } from '../_components/RightWidgets'

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [searchResults, setSearchResults] = useState<PostWithRelations[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hotTags, setHotTags] = useState<string[]>([])

  useEffect(() => {
    fetchHotTags()
  }, [])

  const fetchHotTags = async () => {
    try {
      const result = await api.get('/tags') as unknown as { code: number; data: { id: string; name: string; slug: string }[]; message: string }
      if (result.code === 2000 && result.data) {
        setHotTags(Array.isArray(result.data) ? result.data.slice(0, 10).map(t => t.name) : [])
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery.trim()) {
      setIsSearching(true)
      try {
        // Search by fetching all posts and filtering client-side for now
        // TODO: Add a dedicated search endpoint
        const result = await api.get('/posts', { page: 1, pageSize: 50, status: 'PUBLISHED' }) as unknown as { code: number; data: { items: PostWithRelations[] }; message: string }

        if (result.code === 2000 && result.data) {
          const results = result.data.items.filter((article) =>
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.tags.some((tag) =>
              tag.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
          )
          setSearchResults(results)
        }
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
    }
  }

  const highlightedQuery = useMemo(() => {
    return query.trim().toLowerCase()
  }, [query])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 flex gap-6 max-w-7xl mx-auto"
    >
      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-main">搜索</h1>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-muted">
            <SearchIcon size={18} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="输入关键词搜索文章..."
            className="w-full bg-sidebar border border-border rounded-lg py-3 pl-12 pr-12 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="absolute inset-y-0 right-4 flex items-center text-text-muted hover:text-primary"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search Results */}
        {query.trim() ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              {isSearching ? '搜索中...' : `找到 ${searchResults.length} 篇相关文章`}
            </p>

            {!isSearching && searchResults.length > 0 ? (
              searchResults.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <SearchResultCard
                    article={article}
                    query={highlightedQuery}
                  />
                </motion.div>
              ))
            ) : !isSearching ? (
              <div className="text-center py-16">
                <p className="text-text-muted">未找到相关文章</p>
                <p className="text-sm text-text-muted mt-2">
                  试试其他关键词？
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-text-muted">输入关键词开始搜索</p>
            <div className="mt-8">
              <p className="text-sm text-text-muted mb-4">热门标签</p>
              <div className="flex flex-wrap justify-center gap-2">
                {hotTags.length > 0 ? (
                  hotTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-3 py-1.5 bg-sidebar-active/50 text-text-muted rounded-full text-xs hover:bg-primary hover:text-white transition-colors"
                    >
                      {tag}
                    </button>
                  ))
                ) : (
                  ['linux', 'Kubernetes', 'docker', 'AI', 'git'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-3 py-1.5 bg-sidebar-active/50 text-text-muted rounded-full text-xs hover:bg-primary hover:text-white transition-colors"
                    >
                      {tag}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex-shrink-0 hidden xl:block border-l border-border">
        <RightWidgets />
      </div>
    </motion.div>
  )
}

function SearchResultCard({
  article,
  query,
}: {
  article: PostWithRelations
  query: string
}) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Highlight matching text
  const highlightText = (text: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <article className="border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-sidebar-active/30 transition-colors">
      <div className="flex gap-4">
        {/* Cover Image */}
        {article.coverImage && (
          <Link
            href={`/post/${article.id}`}
            className="w-24 h-16 flex-shrink-0 rounded overflow-hidden"
          >
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </Link>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              {article.category?.name || '未分类'}
            </span>
            <span className="text-[10px] text-text-muted">
              {formatDate(article.publishedAt)}
            </span>
          </div>

          <Link href={`/post/${article.id}`}>
            <h3 className="text-sm font-bold text-text-main hover:text-primary transition-colors line-clamp-1">
              {highlightText(article.title)}
            </h3>
          </Link>

          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {highlightText(article.summary || '')}
          </p>

          <div className="flex gap-2 mt-2">
            {article.tags
              .filter((tag) => tag.name.toLowerCase().includes(query))
              .map((tag) => (
                <span
                  key={tag.id}
                  className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full"
                >
                  #{tag.name}
                </span>
              ))}
          </div>
        </div>
      </div>
    </article>
  )
}

function SearchFallback() {
  return (
    <div className="p-4 sm:p-6 flex gap-6 max-w-7xl mx-auto">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-main">搜索</h1>
        </div>
        <div className="h-12 bg-sidebar rounded-lg animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-sidebar rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  )
}
