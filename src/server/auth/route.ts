import { NextResponse } from 'next/server'
import { errors } from '@/lib/api-response'
import { AccessError, requirePermission, type Actor } from './access'
import type { Permission } from '@/shared/permissions'

export function accessErrorResponse(error: unknown) {
  if (!(error instanceof AccessError)) return undefined
  const payload = error.status === 401 ? errors.unauthorized(error.message)
    : error.status === 403 ? errors.forbidden(error.message) : errors.notFound(error.message)
  return NextResponse.json(payload, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
}

/** Guard before body parsing, protected reads, storage writes or business logic. */
export function withPermission<Context = { params: Record<string, string> }>(
  permission: Permission | readonly Permission[],
  handler: (request: Request, context: Context, actor: Actor) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const actor = await requirePermission(permission)
      const response = await handler(request, context, actor)
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    } catch (error) {
      const denied = accessErrorResponse(error)
      if (denied) return denied
      console.error('Protected request failed:', error)
      return NextResponse.json(errors.serverError(), { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
    }
  }
}
