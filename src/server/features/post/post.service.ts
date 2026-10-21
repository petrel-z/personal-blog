/**
 * Post Service - 文章业务逻辑
 */

import { prisma } from '@/server/db'
import { Prisma } from '@prisma/client'
import { CreatePostInput, UpdatePostInput, PostListParams } from './post.types'
import { AccessError, assertPermission, assertPostOwner, type Actor } from '@/server/auth/access'

export async function getPosts(params: PostListParams, actor?: Actor) {
  const { page = 1, pageSize = 10, status, categoryId, tagSlug } = params

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
  }

  const managementQuery = params.admin || (status && status !== 'PUBLISHED')
  if (managementQuery) {
    assertPermission(actor, 'post:read')
    if (!actor.isAdmin) where.authorId = actor.id
    if (status) where.status = status
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

async function resolvePostTags(names: string[], actor: Actor) {
  if (actor.permissions.includes('tag:manage')) {
    return {
      connectOrCreate: names.map(name => ({
        where: { name },
        create: { name, slug: name.toLowerCase().replace(/\s+/g, '-') },
      })),
    }
  }

  const existing = await prisma.tag.findMany({
    where: { name: { in: names }, deletedAt: null },
    select: { name: true },
  })
  const available = new Set(existing.map(tag => tag.name))
  if (names.some(name => !available.has(name))) {
    throw new AccessError(403, '创建新标签需要标签管理权限，请选择已有标签')
  }
  return { connect: names.map(name => ({ name })) }
}

export async function createPost(data: CreatePostInput, actor: Actor) {
  assertPermission(actor, 'post:create')
  if (data.status === 'PUBLISHED') assertPermission(actor, 'post:publish')
  const tags = data.tags ? await resolvePostTags(data.tags, actor) : undefined
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
      authorId: actor.id,
      categoryId: data.categoryId,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      publishedAt: data.createdAt && data.status === 'PUBLISHED' ? new Date(data.createdAt) : undefined,
      tags,
    },
    include: {
      category: true,
      tags: true,
    },
  })

  return post
}

export async function updatePost(id: string, data: UpdatePostInput, actor: Actor) {
  assertPermission(actor, 'post:update')
  const current = await prisma.post.findUnique({
    where: { id }, select: { authorId: true, status: true, deletedAt: true },
  })
  if (!current || current.deletedAt) throw new AccessError(404, '文章不存在')
  assertPostOwner(actor, current.authorId)
  if (current.status === 'PUBLISHED' || data.status === 'PUBLISHED') {
    assertPermission(actor, 'post:publish')
  }
  const { tags, ...updateData } = data
  const tagRelations = tags ? await resolvePostTags(tags, actor) : undefined

  const post = await prisma.post.update({
    // Recheck the state used for authorization atomically with the write.
    where: { id, authorId: current.authorId, status: current.status, deletedAt: null },
    data: {
      ...updateData,
      tags: tagRelations ? { set: [], ...tagRelations } : undefined,
    },
    include: {
      category: true,
      tags: true,
    },
  })

  return post
}

export async function deletePost(id: string, actor: Actor) {
  assertPermission(actor, 'post:delete')
  const current = await prisma.post.findUnique({
    where: { id }, select: { authorId: true, deletedAt: true },
  })
  if (!current || current.deletedAt) throw new AccessError(404, '文章不存在')
  assertPostOwner(actor, current.authorId)
  await prisma.post.update({
    where: { id, authorId: current.authorId, deletedAt: null },
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
