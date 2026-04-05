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
} from '@/server/features/settings'

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  category: z.string().optional(),
})

const updateSettingsSchema = z.record(z.string())

// GET /api/settings
// Query params: category (optional)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const key = searchParams.get('key')

    // Get single setting by key
    if (key) {
      const value = await getSettingByKey(key)
      return NextResponse.json({
        success: true,
        data: { key, value },
      })
    }

    // Get all settings (optionally filtered by category)
    const settings = await getSettings(category)

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
// Body: { key: string, value: string, category?: string } OR { settings: Record<string, string> }
export async function PUT(request: Request) {
  try {
    const body = await request.json()

    // Bulk update
    if (body.settings && typeof body.settings === 'object') {
      const validated = updateSettingsSchema.safeParse(body.settings)
      if (!validated.success) {
        return NextResponse.json(
          { success: false, error: validated.error.flatten() },
          { status: 400 }
        )
      }

      await updateSettings(validated.data)
      return NextResponse.json({ success: true, message: '设置已更新' })
    }

    // Single update
    const validated = updateSettingSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const setting = await updateSetting(
      validated.data.key,
      validated.data.value,
      validated.data.category
    )

    return NextResponse.json({ success: true, data: setting })
  } catch (error) {
    console.error('Failed to update setting:', error)
    return NextResponse.json(
      { success: false, error: '更新设置失败' },
      { status: 500 }
    )
  }
}
