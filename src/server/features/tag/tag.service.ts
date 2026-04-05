/**
 * Tag Service - 标签业务逻辑
 */

import { prisma } from '@/server/db'

export async function getTags() {
  const tags = await prisma.tag.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: { posts: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return tags.map((tag) => ({
    ...tag,
    postCount: tag._count.posts,
  }))
}

export async function createTag(data: { name: string; slug: string }) {
  return prisma.tag.create({
    data,
  })
}

export async function deleteTag(id: string) {
  // 标签删除不检查文章关联（只解除关系）
  return prisma.tag.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
