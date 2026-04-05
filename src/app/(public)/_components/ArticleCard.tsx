/**
 * ArticleCard - 文章卡片组件
 * 显示：标题、摘要、分类、标签、发布时间、阅读量、点赞数、评论数、封面图、预计阅读时间
 */

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Eye, Heart, MessageCircle } from 'lucide-react'

// Types from client API
interface Tag {
  id: string
  name: string
  slug: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Author {
  id: string
  name?: string | null
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string
  summary?: string | null
  coverImage?: string | null
  status: string
  viewCount: number
  likeCount: number
  commentCount: number
  category?: Category | null
  tags?: Tag[]
  author?: Author | null
  publishedAt?: string | null
}

interface ArticleCardProps {
  post: Post
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const wordCount = content.replace(/<[^>]*>/g, '').length
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute))
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

export function ArticleCard({ post }: ArticleCardProps) {
  const readingTime = calculateReadingTime(post.content)
  const isPinned = (post as Post & { isPinned?: boolean }).isPinned

  return (
    <article className="group border-b border-border overflow-hidden hover:bg-accent/30 transition-colors">
      <div className="flex flex-col md:flex-row gap-4 py-4">
        {/* Cover Image - Left side */}
        {post.coverImage && (
          <Link
            href={`/post/${post.slug}`}
            className="w-full md:w-36 h-24 flex-shrink-0 rounded overflow-hidden relative group-hover:opacity-90 transition-opacity"
          >
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {isPinned && (
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                置顶
              </div>
            )}
          </Link>
        )}

        {/* Content - Right side */}
        <div className="flex-1 flex flex-col justify-between space-y-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {post.category && (
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {post.category.name}
                </span>
              )}
              <div className="flex gap-2">
                {post.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>

            <Link href={`/post/${post.slug}`}>
              <h2 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                {post.title}
              </h2>
            </Link>

            {post.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {post.summary}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              {post.author?.name && (
                <div className="flex items-center gap-1">
                  <span>{post.author.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>{formatDate(post.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye size={12} />
                <span>{post.viewCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle size={12} />
                <span>{post.commentCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
