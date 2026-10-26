import { NextResponse } from 'next/server'
import { errors, success } from '@/lib/api-response'
import { withAdminPermission } from '@/server/auth/route'
import { replaceRolePermissions, RolePermissionError } from '@/server/features/auth/role.service'
import type { Permission } from '@/shared/permissions'

export const PATCH = withAdminPermission('role:update', async (request, { params }, actor) => {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json(errors.badRequest('请求内容必须为有效 JSON'), { status: 400 })
  }
  const permissions = body && typeof body === 'object' && 'permissions' in body ? body.permissions : undefined
  try {
    await replaceRolePermissions(actor, params.id, permissions as Permission[])
    return NextResponse.json(success(null, '权限已更新'))
  } catch (error) {
    if (!(error instanceof RolePermissionError)) throw error
    return NextResponse.json(error.status === 409 ? errors.conflict(error.message) : errors.badRequest(error.message), { status: error.status })
  }
})
