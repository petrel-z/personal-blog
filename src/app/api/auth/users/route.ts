export const dynamic = 'force-dynamic'

import { withPermission } from '@/server/auth/route'
/**
 * Users API Route - Admin user management
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { success, errors } from '@/lib/api-response'

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
