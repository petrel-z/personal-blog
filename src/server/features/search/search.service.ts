import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import type { SearchResultItem } from '@/shared/types/search'
import type { SearchQuery } from './search-query'
import { createSearchExcerpt, escapeSearchKeyword } from './search-text'

/** Search the public corpus only, independent of the caller's session or role. */
export async function searchPosts({ keyword, page, pageSize }: SearchQuery) {
  const contains = escapeSearchKeyword(keyword)
  const where: Prisma.PostWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    OR: [
      { title: { contains } },
      { summary: { contains } },
      { content: { contains } },
      { tags: { some: { deletedAt: null, name: { contains } } } },
    ],
  }

  // Read the page and count from one snapshot, including the selected relations.
  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      select: {
        id: true, title: true, slug: true, summary: true, content: true,
        coverImage: true, publishedAt: true,
        category: { select: { id: true, name: true, slug: true, deletedAt: true } },
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.post.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })

  const items: SearchResultItem[] = posts.map(post => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: createSearchExcerpt(post.summary, post.content, keyword),
    coverImage: post.coverImage,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    category: post.category && !post.category.deletedAt
      ? { id: post.category.id, name: post.category.name, slug: post.category.slug }
      : null,
    tags: post.tags,
  }))

  return { items, total, page, pageSize }
}
