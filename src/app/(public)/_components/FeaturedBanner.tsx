/**
 * FeaturedBanner - 特色文章横幅
 * 显示置顶文章或最新推荐
 */

import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Post } from './ArticleCard'

interface FeaturedBannerProps {
  post?: Post | null
}

export function FeaturedBanner({ post }: FeaturedBannerProps) {
  if (!post) return null

  return (
    <div className="relative h-44 sm:h-56 overflow-hidden group border-b border-border">
      <Image
        src={post.coverImage || 'https://picsum.photos/seed/banner/1200/600'}
        alt={post.title}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-700"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-8">
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-4 text-xs text-gray-300">
            {post.category && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                {post.category.name}
              </span>
            )}
            <span>置顶</span>
          </div>
          <Link href={`/post/${post.id}`}>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight group-hover:text-primary transition-colors">
              {post.title}
            </h1>
          </Link>
          {post.summary && (
            <p className="text-gray-200 text-sm sm:text-base line-clamp-2">
              {post.summary}
            </p>
          )}
        </div>
      </div>

      {/* Banner Controls */}
      <div className="absolute bottom-8 right-8 flex gap-2">
        <button
          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
