export const dynamic = 'force-dynamic'

import { withPermission, withAdminPermission } from '@/server/auth/route'
import { AccessError } from '@/server/auth/access'
import { createManagedUser, ManagedUserError } from '@/server/features/auth/user.service'
import type { ManagedUserInput } from '@/shared/validations/account'
/**
 * Users API Route - Admin user management
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { success, created, errors } from '@/lib/api-response'

// GET /api/auth/users - List all users
export const GET = withPermission('user:read', async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: { role: { select: { id: true, name: true } } },
          orderBy: { role: { name: 'asc' } },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(success(users.map(({ userRoles, ...user }) => ({
      ...user,
      roles: userRoles.map(({ role }) => role),
    }))))
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(errors.serverError('获取用户列表失败'), { status: 500 })
  }
})

export const POST = withAdminPermission('user:create', async (request, _context, actor) => {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json(errors.badRequest('请求内容必须为有效 JSON'), { status: 400 })
  }
  try {
    const user = await createManagedUser(actor, body as ManagedUserInput)
    return NextResponse.json(created(user, '用户创建成功'), { status: 201 })
  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof ManagedUserError) {
      return NextResponse.json(error.status === 409 ? errors.conflict(error.message) : errors.badRequest(error.message), { status: error.status })
    }
    // Prisma diagnostics can contain submitted values; never log them for account creation.
    console.error('Managed user creation unavailable')
    return NextResponse.json(errors.serverError('创建用户失败，请稍后重试'), { status: 500 })
  }
})
