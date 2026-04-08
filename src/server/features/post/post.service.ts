/**
 * Post Service - 文章业务逻辑
 */

import { prisma } from '@/server/db'
import { Prisma } from '@prisma/client'
import { CreatePostInput, UpdatePostInput, PostListParams } from './post.types'

export async function getPosts(params: PostListParams) {
  const { page = 1, pageSize = 10, status, categoryId, tagSlug } = params

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
  }

  // Admin can filter by status, otherwise only show PUBLISHED
  if (status) {
    where.status = status
  } else {
    where.status = 'PUBLISHED'
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (tagSlug) {
    where.tags = {
      some: {
        slug: tagSlug,
      },
    }
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, name: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        { isPinned: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.post.count({ where }),
  ])

  return {
    posts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getPostById(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      category: true,
      tags: true,
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  return post
}

export async function getPostBySlug(slug: string) {
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      category: true,
      tags: true,
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  return post
}

export async function createPost(data: CreatePostInput, authorId: string) {
  // Generate slug from title
  let baseSlug = data.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // Check if slug already exists and append random suffix if needed
  let slug = baseSlug
  let counter = 1
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      content: data.content,
      summary: data.summary,
      coverImage: data.coverImage,
      status: data.status || 'DRAFT',
      isPinned: data.isPinned || false,
      authorId,
      categoryId: data.categoryId,
      tags: data.tags
        ? {
            connectOrCreate: data.tags.map((name) => ({
              where: { name },
              create: {
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
              },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      tags: true,
    },
  })

  return post
}

export async function updatePost(id: string, data: UpdatePostInput) {
  const { tags, ...updateData } = data

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...updateData,
      tags: tags
        ? {
            set: [],
            connectOrCreate: tags.map((name) => ({
              where: { name },
              create: {
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
              },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      tags: true,
    },
  })

  return post
}

export async function deletePost(id: string) {
  await prisma.post.update({
    where: { id },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
    },
  })
}

export async function getAdjacentPosts(categoryId: string | null, currentId: string, currentSortValue: Date | null) {
  // Determine sort field and value: prefer publishedAt, fallback to createdAt
  const sortField = currentSortValue ? 'publishedAt' : 'createdAt'

  // Get current post's sort value if not provided
  let sortValue = currentSortValue
  if (!sortValue) {
    const currentPost = await prisma.post.findUnique({
      where: { id: currentId },
      select: { createdAt: true, publishedAt: true },
    })
    sortValue = currentSortValue || currentPost?.createdAt || new Date()
  }

  // Get previous post (按列表顺序的前一篇文章)
  const prevPost = await prisma.post.findFirst({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: currentId },
      ...(categoryId
        ? { categoryId, [sortField]: { gt: sortValue } }
        : { categoryId: { is: Prisma.DbNull }, [sortField]: { gt: sortValue } }
      ),
    } as Prisma.PostWhereInput,
    orderBy: { [sortField]: 'asc' },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
    },
  })

  // Get next post (按列表顺序的后一篇文章)
  const nextPost = await prisma.post.findFirst({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: currentId },
      ...(categoryId
        ? { categoryId, [sortField]: { lt: sortValue } }
        : { categoryId: { is: Prisma.DbNull }, [sortField]: { lt: sortValue } }
      ),
    } as Prisma.PostWhereInput,
    orderBy: { [sortField]: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
    },
  })

  return { prev: prevPost, next: nextPost }
}
