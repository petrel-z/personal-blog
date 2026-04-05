/**
 * ArticleDetail - 文章详情页
 */

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import {
  Calendar,
  Eye,
  ThumbsUp,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Share2,
  Copy,
  Check,
  List,
} from 'lucide-react'
import { articles } from '../../_components/mock/data'
import { TableOfContents } from '../../_components/TableOfContents'
import { CommentSection } from '../../_components/CommentSection'
import { cn } from '@/lib/utils'

export default function ArticleDetail() {
  const params = useParams()
  const slug = params.slug as string
  const article = articles.find((a) => a.slug === slug) || articles[0]

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(article.likeCount)
  const [isCopied, setIsCopied] = useState(false)
  const [isTOCVisible, setIsTOCVisible] = useState(true)
  const [isCategoryListVisible, setIsCategoryListVisible] = useState(true)

  // Get articles in the same category
  const categoryArticles = articles.filter((a) => a.category === article.category)
  const readingTime = Math.ceil(article.content.length / 300)

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true)
      setLikeCount((prev) => prev + 1)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Left Column: Category Articles (Collapsible) */}
      <div
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out flex-shrink-0 relative',
          isCategoryListVisible ? 'w-64' : 'w-0 border-none'
        )}
      >
        {isCategoryListVisible && (
          <div className="w-64 flex flex-col h-full overflow-hidden">
            <div className="p-4 h-14 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-bold text-text-muted flex items-center gap-2 truncate">
                <List size={14} />
                {article.category}
              </h3>
              <button
                onClick={() => setIsCategoryListVisible(false)}
                className="p-1.5 rounded hover:bg-sidebar-active/50 text-text-muted transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-2">
                {categoryArticles.map((item) => {
                  const isActive = item.slug === slug
                  return (
                    <Link
                      key={item.id}
                      href={`/post/${item.slug}`}
                      className={cn(
                        'block py-2 px-3 rounded text-xs transition-colors line-clamp-2',
                        isActive
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-text-muted hover:bg-sidebar-active/50 hover:text-text-main'
                      )}
                    >
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Category List Button (Fixed when hidden) */}
      {!isCategoryListVisible && (
        <div className="absolute left-0 top-4 z-40 pl-4">
          <button
            onClick={() => setIsCategoryListVisible(true)}
            className="w-10 h-10 rounded-lg bg-card shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all hover:shadow-lg"
          >
            <List size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full px-8 py-4">
          <article className="overflow-hidden">
            {/* Header */}
            <header className="space-y-4 mb-8 pb-8 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <span>{article.category}</span>
                  <span>/</span>
                  <span className="text-primary">{article.tags[0]}</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-text-main leading-tight">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider font-bold">
                <div className="flex items-center gap-1.5">
                  <User size={12} />
                  <span>tl.s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>{article.publishDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye size={12} />
                  <span>{article.viewCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{readingTime} min</span>
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="prose dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Actions */}
            <div className="mt-16 flex flex-col items-center gap-6 py-10 border-t border-border">
              <button
                onClick={handleLike}
                disabled={isLiked}
                className={`flex flex-col items-center gap-2 group transition-all ${
                  isLiked ? 'text-primary' : 'text-text-muted hover:text-primary'
                }`}
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
                    isLiked
                      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
                      : 'border-border group-hover:border-primary group-hover:bg-primary/5'
                  }`}
                >
                  <ThumbsUp size={28} className={isLiked ? 'fill-primary' : ''} />
                </div>
                <span className="text-sm font-bold">{likeCount} 点赞</span>
              </button>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-active/30 text-text-muted hover:text-primary transition-all text-xs font-bold"
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  {isCopied ? '已复制' : '复制链接'}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-active/30 text-text-muted hover:text-primary transition-all text-xs font-bold">
                  <Share2 size={14} />
                  分享
                </button>
              </div>
            </div>

            {/* Prev/Next Navigation */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="#"
                className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  <ChevronLeft size={12} />
                  上一篇
                </div>
                <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                  没有了，已经是第一篇
                </div>
              </Link>
              <Link
                href="#"
                className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group text-right"
              >
                <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  下一篇
                  <ChevronRight size={12} />
                </div>
                <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                  ceph mon Operation not permitted 问题解决
                </div>
              </Link>
            </div>
          </article>

          {/* Comments */}
          <CommentSection />

          {/* Footer inside scrollable area */}
          <footer className="mt-20 py-6 border-t border-border">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-text-muted">
              <p>© 2026 Oskyla 烹茶室. Powered by AI Studio.</p>
              <div className="flex items-center gap-4">
                <a href="/about" className="hover:text-primary transition-colors">
                  关于本站
                </a>
                <a href="/guestbook" className="hover:text-primary transition-colors">
                  留言板
                </a>
                <a href="/rss" className="hover:text-primary transition-colors">
                  RSS 订阅
                </a>
                <a href="/links" className="hover:text-primary transition-colors">
                  友情链接
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Right Column: TOC (Collapsible & Fixed) */}
      <div
        className={cn(
          'hidden lg:flex flex-col border-l border-border bg-background transition-all duration-300 ease-in-out flex-shrink-0 h-full relative',
          isTOCVisible ? 'w-80' : 'w-0 border-none'
        )}
      >
        {isTOCVisible && (
          <div className="w-80 h-full flex flex-col overflow-hidden">
            <div className="p-4 h-14 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-bold text-text-muted flex items-center gap-2">
                <List size={14} />
                文章目录
              </h3>
              <button
                onClick={() => setIsTOCVisible(false)}
                className="p-1.5 rounded hover:bg-sidebar-active/50 text-text-muted transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <TableOfContents onToggle={() => setIsTOCVisible(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Toggle TOC Button (Fixed when hidden) */}
      {!isTOCVisible && (
        <div className="absolute right-0 top-4 z-40 pr-8">
          <button
            onClick={() => setIsTOCVisible(true)}
            className="w-10 h-10 rounded-lg bg-card shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all hover:shadow-lg"
          >
            <List size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
