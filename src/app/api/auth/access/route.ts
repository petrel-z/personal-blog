import { NextResponse } from 'next/server'
import { getActor } from '@/server/auth/access'
import { getPostLoginPath } from '@/shared/permissions'
import { success, errors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json(errors.unauthorized('请先登录'), {status:401,headers})
    const callbackUrl = new URL(request.url).searchParams.get('callbackUrl') || undefined
    return NextResponse.json(success({permissions:actor.permissions, destination:getPostLoginPath(actor.permissions,callbackUrl)}),{headers})
  } catch {
    return NextResponse.json(errors.serverError('暂时无法获取账号权限'),{status:503,headers})
  }
}
