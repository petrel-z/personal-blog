/**
 * Settings API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getSettings,
  getSettingByKey,
  updateSetting,
  updateSettings,
  SiteSettings,
} from '@/server/features/settings'

// Schema for bulk settings update from frontend
const updateSettingsSchema = z.object({
  blogName: z.string().optional(),
  blogDescription: z.string().optional(),
  blogKeywords: z.string().optional(),
  ogImage: z.string().optional(),
  githubUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  autoApproveComments: z.boolean().optional(),
  requireEmailForComments: z.boolean().optional(),
})

// GET /api/settings
export async function GET() {
  try {
    const settings = await getSettings()

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { success: false, error: '获取设置失败' },
      { status: 500 }
    )
  }
}

// PUT /api/settings
// Body: SiteSettings object
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const validated = updateSettingsSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    // Convert boolean values to strings for storage
    const settingsToStore: Record<string, string> = {}
    for (const [key, value] of Object.entries(validated.data)) {
      if (value !== undefined) {
        settingsToStore[key] = String(value)
      }
    }

    await updateSettings(settingsToStore)

    return NextResponse.json({ success: true, message: '设置已更新' })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json(
      { success: false, error: '更新设置失败' },
      { status: 500 }
    )
  }
}
