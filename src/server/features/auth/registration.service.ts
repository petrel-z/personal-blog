import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { consumeCaptcha } from './captcha.service'
import { normalizeEmail } from './identity'

const registrationSchema = z.object({
  captchaId: z.string().min(1).max(64),
  captchaCode: z.string().length(4),
  name: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50字符'),
  email: z.string().trim().email('邮箱格式无效').max(254).transform(normalizeEmail),
  password: z.string().min(6, '密码至少6位').max(100, '密码不能超过100位'),
})

export class RegistrationError extends Error {
  constructor(readonly reason: 'invalid' | 'captcha' | 'conflict', message: string) {
    super(message)
  }
}

// Both public sign-up and admin account creation use the same validation and member assignment.
export async function registerMember(input: unknown) {
  const validated = registrationSchema.safeParse(input)
  if (!validated.success) {
    throw new RegistrationError('invalid', validated.error.errors[0]?.message || '注册信息验证失败')
  }
  const { name, email, password, captchaId, captchaCode } = validated.data
  if (!await consumeCaptcha({ id: captchaId, code: captchaCode, purpose: 'register' })) {
    throw new RegistrationError('captcha', '验证码错误或已过期')
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new RegistrationError('conflict', '该邮箱已被注册')
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  try {
    return await prisma.$transaction(async tx => {
      const role = await tx.role.upsert({
        where: { name: 'member' },
        create: { name: 'member', description: 'Default role for new registered users' },
        update: {},
      })
      return tx.user.create({
        data: { name, email, password: hashedPassword, userRoles: { create: { roleId: role.id } } },
        select: { id: true, name: true, email: true, createdAt: true },
      })
    })
  } catch (error) {
    // A concurrent registration may claim the email after the initial existence check.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' &&
        String(error.meta?.target).includes('email')) {
      throw new RegistrationError('conflict', '该邮箱已被注册')
    }
    throw error
  }
}
