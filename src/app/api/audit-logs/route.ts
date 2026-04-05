/**
 * Audit Logs API Routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuditLogs, createAuditLog } from '@/server/features/audit-log'

export const dynamic = 'force-dynamic'

const createAuditLogSchema = z.object({
  userId: z.string().optional(),
  action: z.string().min(1),
  target: z.string().optional(),
  details: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})

// GET /api/audit-logs
// Query params: page, pageSize, userId, action, startDate, endDate
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 20
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') || undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const result = await getAuditLogs({
      page,
      pageSize,
      userId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    return NextResponse.json({
      success: true,
      data: result.logs,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(
      { success: false, error: '获取审计日志失败' },
      { status: 500 }
    )
  }
}

// POST /api/audit-logs
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createAuditLogSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.flatten() },
        { status: 400 }
      )
    }

    const log = await createAuditLog(validated.data)

    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    return NextResponse.json(
      { success: false, error: '创建审计日志失败' },
      { status: 500 }
    )
  }
}
