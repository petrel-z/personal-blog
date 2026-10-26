import { NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { withAdminPermission } from '@/server/auth/route'
import { listRoles } from '@/server/features/auth/role.service'

export const dynamic = 'force-dynamic'

export const GET = withAdminPermission('role:read', async (_request, _context, actor) => {
  return NextResponse.json(success(await listRoles(actor)))
})
