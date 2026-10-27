import { auth } from '@/auth'
import { prisma } from '@/server/db'
import { PERMISSIONS, type Permission } from '@/shared/permissions'
import { getEffectiveRolePermissions } from '@/shared/roles'
import { isValidSessionVersion } from '@/server/features/auth/session-version.service'

export interface Actor {
  id: string
  isAdmin: boolean
  permissions: readonly Permission[]
}

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404, message: string) {
    super(message)
    this.name = 'AccessError'
  }
}

/** Read current grants; a JWT establishes identity, never current authorization. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth()
  if (!session?.user?.id || !isValidSessionVersion(session.user.sessionVersion)) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      deletedAt: true,
      sessionVersion: true,
      userRoles: {
        select: { role: { select: {
          name: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
        } } },
      },
    },
  })
  if (!user || user.deletedAt || user.sessionVersion !== session.user.sessionVersion) return null

  const isAdmin = user.userRoles.some(({ role }) => role.name === 'admin')
  const granted = new Set(user.userRoles.flatMap(({ role }) =>
    getEffectiveRolePermissions(role.name, role.rolePermissions.map(({ permission }) => permission.code))))
  return {
    id: user.id,
    isAdmin,
    permissions: PERMISSIONS.filter(code => granted.has(code)),
  }
}

export function assertPermission(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new AccessError(401, '请先登录')
  if (!actor.permissions.includes(permission)) throw new AccessError(403, '权限不足，无法执行此操作')
}

export async function requirePermission(permission: Permission | readonly Permission[]): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new AccessError(401, '请先登录')
  const required = typeof permission === 'string' ? [permission] : permission
  if (!required.some(code => actor.permissions.includes(code))) {
    throw new AccessError(403, '权限不足，无法执行此操作')
  }
  return actor
}

export async function requireAdminPermission(permission: Permission): Promise<Actor> {
  const actor = await requirePermission(permission)
  if (!actor.isAdmin) throw new AccessError(403, '仅管理员可执行此操作')
  return actor
}

export function assertPostOwner(actor: Actor, authorId: string) {
  if (!actor.isAdmin && actor.id !== authorId) {
    throw new AccessError(403, '只能管理自己的文章')
  }
}
