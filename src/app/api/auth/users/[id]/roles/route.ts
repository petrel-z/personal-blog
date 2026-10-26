import { NextResponse } from 'next/server'
import { errors, success } from '@/lib/api-response'
import { withAdminPermission } from '@/server/auth/route'
import { replaceUserRoles, RoleAssignmentError } from '@/server/features/auth/user.service'

export const PATCH = withAdminPermission('user:assign-role', async (request, { params }, actor) => {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json(errors.badRequest('请求内容必须为有效 JSON'), { status: 400 })
  }
  const roleIds = body && typeof body === 'object' && 'roleIds' in body ? body.roleIds : undefined
  try {
    await replaceUserRoles(actor, params.id, roleIds as string[])
    return NextResponse.json(success(null, '角色已更新'))
  } catch (error) {
    if (!(error instanceof RoleAssignmentError)) throw error
    return NextResponse.json(error.status === 409 ? errors.conflict(error.message) : errors.badRequest(error.message), { status: error.status })
  }
})
