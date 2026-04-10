/**
 * Users API Route - Admin user management
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { success, errors } from '@/lib/api-response'

// GET /api/auth/users - List all users
export async function GET() {
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

    return NextResponse.json(success(users))
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(errors.serverError('获取用户列表失败'))
  }
}
