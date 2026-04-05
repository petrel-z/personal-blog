/**
 * Settings Service - 系统设置业务逻辑
 */

import { prisma } from '@/server/db'

export async function getSettings(category?: string) {
  const where: any = {}
  if (category) {
    where.category = category
  }

  const settings = await prisma.settings.findMany({
    where,
    orderBy: { key: 'asc' },
  })

  // Convert to key-value object
  const settingsMap: Record<string, string> = {}
  for (const s of settings) {
    settingsMap[s.key] = s.value
  }

  return settingsMap
}

export async function getSettingByKey(key: string) {
  const setting = await prisma.settings.findUnique({
    where: { key },
  })
  return setting?.value || null
}

export async function updateSetting(key: string, value: string, category?: string) {
  return prisma.settings.upsert({
    where: { key },
    create: {
      key,
      value,
      category,
    },
    update: {
      value,
      category,
    },
  })
}

export async function updateSettings(settings: Record<string, string>) {
  const updates = Object.entries(settings).map(([key, value]) =>
    prisma.settings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  )

  return prisma.$transaction(updates)
}

export async function deleteSetting(key: string) {
  return prisma.settings.delete({
    where: { key },
  })
}
