import { NextResponse } from 'next/server'
import { issueCaptcha, consumeCaptcha } from '@/server/features/auth/captcha.service'
import { isCaptchaPurpose } from '@/shared/types/auth'
import { errors, success } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const purpose = new URL(request.url).searchParams.get('purpose') || 'comment'
  if (!isCaptchaPurpose(purpose)) return NextResponse.json(errors.badRequest('验证码用途无效'), {status:400})
  try {
    const { id, svg } = await issueCaptcha(purpose)
    return new NextResponse(svg, {headers:{
      'Content-Type':'image/svg+xml', 'Cache-Control':'no-store', 'X-Captcha-Id':id,
    }})
  } catch {
    return NextResponse.json(errors.serverError('验证码暂时不可用'), {status:503})
  }
}

// Compatibility for comment clients only. Authentication consumes its own challenge.
export async function POST(request: Request) {
  try {
    const { captchaId, code } = await request.json()
    const valid = await consumeCaptcha({id:captchaId, code, purpose:'comment'})
    return NextResponse.json(valid ? success(null, '验证成功') : errors.badRequest('验证码错误或已过期'), {status:valid ? 200 : 400, headers:{'Cache-Control':'no-store'}})
  } catch (error) {
    return NextResponse.json(error instanceof SyntaxError ? errors.badRequest() : errors.serverError('验证暂时不可用'), {status:error instanceof SyntaxError ? 400 : 503})
  }
}
