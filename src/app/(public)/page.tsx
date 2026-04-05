/**
 * Homepage - 首页
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { articles } from './_components/mock/data'
import { RightWidgets } from './_components/RightWidgets'
import { cn } from '@/lib/utils'

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 5

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 flex gap-6 max-w-7xl mx-auto"
    >
      {/* Article List */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Featured Banner */}
        <div className="relative h-44 sm:h-56 overflow-hidden group border-b border-border">
          <img
            src="https://picsum.photos/seed/banner/1200/600"
            alt="Featured Banner"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-8">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-4 text-xs text-gray-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  置顶
                </span>
                <span>2025年06月15日</span>
              </div>
              <Link href="/post/finance-calculator">
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight group-hover:text-primary transition-colors">
                  个人作品清单
                </h1>
              </Link>
              <p className="text-gray-200 text-sm sm:text-base line-clamp-2">
                收录所有个人开发项目信息形成清单，包括技术栈、项目背景、核心功能等。
              </p>
            </div>
          </div>

          {/* Banner Controls */}
          <div className="absolute bottom-8 right-8 flex gap-2">
            <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Article List */}
        <div className="space-y-0">
          {articles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ArticleCard article={article} />
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-text-muted disabled:hover:border-border transition-all"
          >
            <ChevronLeft size={18} />
          </button>

          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'w-10 h-10 rounded-lg border transition-all text-sm font-medium',
                currentPage === page
                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-card border-border text-text-muted hover:text-primary hover:border-primary'
              )}
            >
              {page}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:hover:text-text-muted disabled:hover:border-border transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex-shrink-0 hidden xl:block border-l border-border">
        <RightWidgets />
      </div>
    </motion.div>
  )
}

function ArticleCard({ article }: { article: (typeof articles)[0] }) {
  return (
    <article className="border-b border-border overflow-hidden hover:bg-sidebar-active/30 transition-colors group">
      <div className="flex flex-col md:flex-row gap-4 py-4">
        {/* Cover Image */}
        {article.coverImage && (
          <Link
            href={`/post/${article.slug}`}
            className="w-full md:w-36 h-24 flex-shrink-0 rounded overflow-hidden relative group-hover:opacity-90 transition-opacity"
          >
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {article.isPinned && (
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                置顶
              </div>
            )}
          </Link>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between space-y-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {article.category}
              </span>
              <div className="flex gap-2">
                {article.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <Link href={`/post/${article.slug}`}>
              <h2 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors leading-tight">
                {article.title}
              </h2>
            </Link>

            <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span>tl.s</span>
              <span>{article.publishDate}</span>
              <span>{article.commentCount} 评论</span>
              <span>{article.viewCount} 阅读</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
