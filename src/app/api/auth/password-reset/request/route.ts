import { NextResponse } from 'next/server'
import { ApiCode, error as apiError, success } from '@/lib/api-response'
import { getClientIp } from '@/server/lib/request'
import { requestPasswordReset } from '@/server/features/auth/password-reset.service'
import { PasswordResetError } from '@/server/features/auth/password-reset-error'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' }
  try {
    const body = await request.json()
    const result = await requestPasswordReset({ ...body, ip: getClientIp(request) ?? 'unknown' })
    return NextResponse.json(success({ retryAfterSeconds: result.retryAfterSeconds }, result.message), { headers })
  } catch (error) {
    if (error instanceof PasswordResetError) {
      const status = error.reason === 'limited' ? 429 : error.reason === 'unavailable' ? 503 : 400
      const code = status === 429 ? ApiCode.RATE_LIMITED : status === 503 ? ApiCode.SERVICE_UNAVAILABLE : ApiCode.BAD_REQUEST
      if (status === 429) headers['Retry-After'] = String(error.retryAfterSeconds)
      return NextResponse.json(apiError(code, error.message,
        status === 429 ? { retryAfterSeconds: error.retryAfterSeconds } : null), { status, headers })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(apiError(ApiCode.BAD_REQUEST, '请求格式无效'), { status: 400, headers })
    }
    console.error('Password reset request service unavailable')
    return NextResponse.json(apiError(ApiCode.SERVICE_UNAVAILABLE, '密码找回服务暂时不可用'), { status: 503, headers })
  }
}
