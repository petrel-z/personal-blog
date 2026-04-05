/**
 * Sensitive Word Service - 敏感词业务逻辑
 */

import { prisma } from '@/server/db'

export async function getSensitiveWords(params: {
  page?: number
  pageSize?: number
  category?: string
}) {
  const { page = 1, pageSize = 20, category } = params

  const where: any = {}
  if (category) {
    where.category = category
  }

  const [words, total] = await Promise.all([
    prisma.sensitiveWord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sensitiveWord.count({ where }),
  ])

  return {
    words,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getAllSensitiveWords() {
  const words = await prisma.sensitiveWord.findMany({
    where: { isActive: true },
    select: { word: true },
  })
  return words.map((w) => w.word)
}

export async function createSensitiveWord(data: {
  word: string
  category?: string
  isActive?: boolean
}) {
  return prisma.sensitiveWord.create({
    data: {
      word: data.word,
      category: data.category || null,
      isActive: data.isActive ?? true,
    },
  })
}

export async function updateSensitiveWord(
  id: string,
  data: {
    word?: string
    category?: string | null
    isActive?: boolean
  }
) {
  return prisma.sensitiveWord.update({
    where: { id },
    data: {
      word: data.word,
      category: data.category,
      isActive: data.isActive,
    },
  })
}

export async function deleteSensitiveWord(id: string) {
  return prisma.sensitiveWord.delete({
    where: { id },
  })
}

export async function checkSensitiveWords(text: string): Promise<boolean> {
  const words = await getAllSensitiveWords()
  const lowerText = text.toLowerCase()

  for (const word of words) {
    if (lowerText.includes(word.toLowerCase())) {
      return true
    }
  }
  return false
}

export async function findSensitiveWords(text: string): Promise<string[]> {
  const words = await getAllSensitiveWords()
  const found: string[] = []
  const lowerText = text.toLowerCase()

  for (const word of words) {
    if (lowerText.includes(word.toLowerCase())) {
      found.push(word)
    }
  }
  return found
}
