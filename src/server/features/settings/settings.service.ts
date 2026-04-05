/**
 * Settings Service - 系统设置业务逻辑
 */

import { prisma } from '@/server/db'

// Settings keys and their types
export interface SiteSettings {
  blogName: string
  blogDescription: string
  blogKeywords: string
  ogImage: string
  githubUrl: string
  twitterUrl: string
  autoApproveComments: boolean
  requireEmailForComments: boolean
}

// Default settings
const DEFAULT_SETTINGS: SiteSettings = {
  blogName: '',
  blogDescription: '',
  blogKeywords: '',
  ogImage: '',
  githubUrl: '',
  twitterUrl: '',
  autoApproveComments: false,
  requireEmailForComments: true,
}

// Parse string value to appropriate type
function parseSettingValue(key: string, value: string): string | boolean {
  // Boolean settings
  if (key === 'autoApproveComments' || key === 'requireEmailForComments') {
    return value === 'true' || value === '1'
  }
  return value
}

export async function getSettings(): Promise<SiteSettings> {
  const settings = await prisma.settings.findMany()

  const result = { ...DEFAULT_SETTINGS }
  for (const s of settings) {
    if (s.key in result) {
      (result as any)[s.key] = parseSettingValue(s.key, s.value)
    }
  }

  return result
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
