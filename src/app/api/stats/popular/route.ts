import { NextResponse } from 'next/server'
import { withPermission } from '@/server/auth/route'
import { success, errors } from '@/lib/api-response'
import { getAdminPopularPosts, type StatsPeriod } from '@/server/features/stats/admin-stats.service'

export const dynamic = 'force-dynamic'
export const GET = withPermission('dashboard:view', async request => {
  const period = new URL(request.url).searchParams.get('period') ?? '30d'
  if (!['7d', '30d', '90d', 'all'].includes(period)) return NextResponse.json(errors.validationError('请选择有效的统计周期'), { status: 400 })
  return NextResponse.json(success({ items: await getAdminPopularPosts(period as StatsPeriod | 'all') }))
})
