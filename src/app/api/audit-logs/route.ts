import { withPermission } from '@/server/auth/route'
/**
 * Audit Logs API Routes
 */

import { NextResponse } from 'next/server'
import { getAuditLogs } from '@/server/features/audit-log'
import { errors, paginated } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

// GET /api/audit-logs
// Query params: page, pageSize, userId, action, startDate, endDate
export const GET = withPermission('audit:read', async function GET(request: Request) {
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

    return NextResponse.json(
      paginated(result.logs, result.total, result.page, result.pageSize)
    )
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(errors.serverError('获取审计日志失败'))
  }
})
