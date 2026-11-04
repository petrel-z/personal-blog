import { NextResponse } from 'next/server'
import { errors } from '@/lib/api-response'
import { AccessError, requirePermission, requireAdminPermission, type Actor } from './access'
import type { Permission } from '@/shared/permissions'

export function accessErrorResponse(error: unknown) {
  if (!(error instanceof AccessError)) return undefined
  const payload = error.status === 401 ? errors.unauthorized(error.message)
    : error.status === 403 ? errors.forbidden(error.message) : errors.notFound(error.message)
  return NextResponse.json(payload, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
}

type AuthorizedHandler<Context> = (request: Request, context: Context, actor: Actor) => Promise<Response>

/** Guard before body parsing, protected reads, storage writes or business logic. */
function withActor<Context>(
  resolveActor: () => Promise<Actor>,
  handler: AuthorizedHandler<Context>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const actor = await resolveActor()
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

export function withPermission<Context = { params: Record<string, string> }>(
  permission: Permission | readonly Permission[],
  handler: AuthorizedHandler<Context>,
) {
  return withActor(() => requirePermission(permission), handler)
}

export function withAdminPermission<Context = { params: Record<string, string> }>(
  permission: Permission,
  handler: AuthorizedHandler<Context>,
) {
  return withActor(() => requireAdminPermission(permission), handler)
}
