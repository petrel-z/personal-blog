/**
 * Post Service - 文章业务逻辑
 */

import { prisma } from '@/server/db'
import { CreatePostInput, UpdatePostInput, PostListParams } from './post.types'

export async function getPosts(params: PostListParams) {
  const { page = 1, pageSize = 10, status, categoryId, tagSlug } = params

  const where: any = {
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
  const slug = data.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

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
