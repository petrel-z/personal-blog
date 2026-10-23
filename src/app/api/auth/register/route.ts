import { NextResponse } from 'next/server'
import { registerMember, RegistrationError } from '@/server/features/auth/registration.service'
import { success, errors } from '@/lib/api-response'

// Account creation only: adding a user must preserve the current administrator's session.
export async function POST(request: Request) {
  try {
    const user = await registerMember(await request.json())
    return NextResponse.json(success(user, '注册成功'), { status: 201 })
  } catch (error) {
    if (error instanceof RegistrationError) {
      const response = error.reason === 'invalid' ? errors.validationError(error.message)
        : error.reason === 'conflict' ? errors.conflict(error.message) : errors.badRequest(error.message)
      return NextResponse.json(response, { status: error.reason === 'conflict' ? 409 : 400 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(errors.badRequest('请求格式无效'), { status: 400 })
    }
    console.error('Registration service unavailable')
    return NextResponse.json(errors.serverError('注册服务暂时不可用'), { status: 503 })
  }
}
