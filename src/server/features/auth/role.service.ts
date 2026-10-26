import { z } from 'zod'
import { prisma } from '@/server/db'
import { AccessError, assertPermission, type Actor } from '@/server/auth/access'
import { ROLE_DEFINITIONS, getEffectiveRolePermissions } from '@/shared/roles'
import { PERMISSIONS, isAdminPermission, type Permission } from '@/shared/permissions'
import type { BuiltinRoleName, RoleSummary } from '@/shared/types/authorization'
import { AuditAction } from '@/server/features/audit-log/audit-log.service'
import { withAdminTransaction } from './admin-transaction'

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

export class RolePermissionError extends Error {
  constructor(public readonly status: 400 | 409, message: string) {
    super(message)
    this.name = 'RolePermissionError'
  }
}

const permissionSelection = z.array(z.string().refine((code): code is Permission =>
  PERMISSIONS.includes(code as Permission) && !isAdminPermission(code as Permission),
)).max(PERMISSIONS.length).refine(codes => new Set(codes).size === codes.length)

export async function replaceRolePermissions(actor: Actor, roleId: string, codes: Permission[]): Promise<void> {
  assertPermission(actor, 'role:update')
  if (!actor.isAdmin) throw new AccessError(403, '仅管理员可执行此操作')
  const selection = permissionSelection.safeParse(codes)
  if (!z.string().min(1).max(191).safeParse(roleId).success || !selection.success) {
    throw new RolePermissionError(400, '请选择有效且不重复的业务权限，不能分配管理员专属权限')
  }
  const after = [...selection.data].sort()

  await withAdminTransaction(actor, async tx => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, rolePermissions: { select: { permission: { select: { code: true } } } } },
    })
    if (!role) throw new AccessError(404, '角色不存在')
    if (role.name !== 'editor' && role.name !== 'reviewer') {
      throw new RolePermissionError(409, '只有编辑者和审核者的业务权限可以修改')
    }
    // Compare stored grants so saving also removes obsolete or accidentally protected codes.
    const before = role.rolePermissions.map(link => link.permission.code).sort()
    if (before.length === after.length && before.every((code, index) => code === after[index])) return

    const permissionIds: string[] = []
    for (const code of after) {
      const permission = await tx.permission.upsert({ where: { code }, create: { code }, update: {} })
      permissionIds.push(permission.id)
    }
    await tx.rolePermission.deleteMany({ where: { roleId } })
    if (permissionIds.length) {
      await tx.rolePermission.createMany({ data: permissionIds.map(permissionId => ({ roleId, permissionId })) })
    }
    await tx.auditLog.create({ data: {
      userId: actor.id,
      action: AuditAction.ROLE_PERMISSION_UPDATE,
      target: roleId,
      details: JSON.stringify({ role: role.name, before, after }),
    } })
  })
}
