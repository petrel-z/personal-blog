/**
 * Registration API Route
 */

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { success, errors } from '@/lib/api-response'

// API 专用的注册 schema（captcha 在前端已验证）
const registerApiSchema = z.object({
  name: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50字符'),
  email: z.string().email('邮箱格式无效'),
  password: z.string().min(6, '密码至少6位').max(100, '密码不能超过100位'),
})

// POST /api/auth/register
export async function POST(request: Request) {
  try {
    console.log(1)
    const body = await request.json()
    const validated = registerApiSchema.safeParse(body)

    if (!validated.success) {
      console.log('Validation error:', validated.error.errors)
      return NextResponse.json(
        errors.validationError(validated.error.errors[0]?.message || '注册信息验证失败')
      )
    }

    const { name, email, password } = validated.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        errors.conflict('该邮箱已被注册')
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

    // --- 新增逻辑：分配默认角色 ---
    const defaultRoleName = 'member'; // 定义默认角色名

    // 查找 'member' 角色
    let defaultRole = await prisma.role.findUnique({
      where: { name: defaultRoleName },
    });

    // 如果 'member' 角色不存在，则创建它 (可选，根据实际需求决定是否在此处自动创建)
    if (!defaultRole) {
      defaultRole = await prisma.role.create({
        data: {
          name: defaultRoleName,
          description: 'Default role for new registered users',
        },
      });
      console.log(`Role '${defaultRoleName}' created.`);
    }

    // 将用户与默认角色关联
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: defaultRole.id,
      },
    });
    // --- 新增逻辑结束 ---

    return NextResponse.json(
      success(user, '注册成功'),
      { status: 201 }
    )
  } catch (error) {
    console.log(2)
    console.error('Registration error:', error)
    return NextResponse.json(
      errors.serverError('注册失败')
    )
  }
}
