import { prisma } from '@/server/db'
import { AccessError, assertPermission, type Actor } from '@/server/auth/access'
import { ROLE_DEFINITIONS, getEffectiveRolePermissions } from '@/shared/roles'
import type { BuiltinRoleName, RoleSummary } from '@/shared/types/authorization'

export async function listRoles(actor: Actor): Promise<RoleSummary[]> {
  assertPermission(actor, 'role:read')
  if (!actor.isAdmin) throw new AccessError(403, '仅管理员可执行此操作')

  const names = Object.keys(ROLE_DEFINITIONS) as BuiltinRoleName[]
  const roles = await prisma.role.findMany({
    where: { name: { in: names } },
    select: {
      id: true,
      name: true,
      description: true,
      rolePermissions: { select: { permission: { select: { code: true } } } },
      _count: { select: { userRoles: { where: { user: { deletedAt: null } } } } },
    },
  })
  const byName = new Map(roles.map(role => [role.name, role]))
  return names.flatMap(name => {
    const role = byName.get(name)
    if (!role) return []
    return [{
      id: role.id,
      name,
      description: role.description,
      memberCount: role._count.userRoles,
      permissions: getEffectiveRolePermissions(name, role.rolePermissions.map(({ permission }) => permission.code)),
    }]
  })
}
