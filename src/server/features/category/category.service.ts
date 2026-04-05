/**
 * Category Service - 分类业务逻辑
 */

import { prisma } from '@/server/db'

export async function getCategories() {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: { posts: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return categories.map((cat) => ({
    ...cat,
    postCount: cat._count.posts,
  }))
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { posts: true },
      },
    },
  })
}

export async function createCategory(data: {
  name: string
  slug: string
  description?: string
}) {
  return prisma.category.create({
    data,
  })
}

export async function updateCategory(
  id: string,
  data: { name?: string; slug?: string; description?: string }
) {
  return prisma.category.update({
    where: { id },
    data,
  })
}

export async function deleteCategory(id: string) {
  // 检查是否有文章关联
  const postCount = await prisma.post.count({
    where: { categoryId: id, deletedAt: null },
  })

  if (postCount > 0) {
    throw new Error(`该分类下有 ${postCount} 篇文章，请先移动或删除`)
  }

  return prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
