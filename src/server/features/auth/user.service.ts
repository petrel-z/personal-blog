import { z } from 'zod'
import { AccessError, assertPermission, type Actor } from '@/server/auth/access'
import { ROLE_DEFINITIONS } from '@/shared/roles'
import { AuditAction } from '@/server/features/audit-log/audit-log.service'
import { withAdminTransaction } from './admin-transaction'

export class RoleAssignmentError extends Error {
  constructor(public readonly status: 400 | 409, message: string) {
    super(message)
    this.name = 'RoleAssignmentError'
  }
}

const inputSchema = z.object({
  userId: z.string().min(1).max(191),
  roleIds: z.array(z.string().min(1).max(191)).max(4)
    .refine(ids => new Set(ids).size === ids.length),
})

export async function replaceUserRoles(actor: Actor, userId: string, roleIds: string[]): Promise<void> {
  assertPermission(actor, 'user:assign-role')
  const input = inputSchema.safeParse({ userId, roleIds })
  if (!input.success) throw new RoleAssignmentError(400, '请选择零到四个不重复的有效角色')

  await withAdminTransaction(actor, async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, userRoles: { select: { roleId: true, role: { select: { id: true, name: true } } } } },
    })
    if (!user || user.deletedAt) throw new AccessError(404, '用户不存在或已删除')
    const selected = await tx.role.findMany({
      where: { id: { in: input.data.roleIds } }, select: { id: true, name: true },
    })
    if (selected.length !== roleIds.length || selected.some(role => !Object.hasOwn(ROLE_DEFINITIONS, role.name))) {
      throw new RoleAssignmentError(400, '只能分配系统中已存在的内置角色，请刷新后重试')
    }
    const before = user.userRoles.map(({ role }) => role).sort((a, b) => a.name.localeCompare(b.name))
    const after = selected.sort((a, b) => a.name.localeCompare(b.name))
    if (before.length === after.length && before.every((role, index) => role.id === after[index].id)) return

    const admin = before.find(role => role.name === 'admin')
    if (admin && !after.some(role => role.name === 'admin')) {
      const remaining = await tx.userRole.count({ where: { roleId: admin.id, user: { deletedAt: null } } })
      if (remaining <= 1) throw new RoleAssignmentError(409, '不能移除最后一位有效管理员的管理员角色')
    }
    await tx.userRole.deleteMany({ where: { userId } })
    if (after.length) await tx.userRole.createMany({ data: after.map(role => ({ userId, roleId: role.id })) })
    await tx.auditLog.create({ data: {
      userId: actor.id, action: AuditAction.USER_ROLE_UPDATE, target: userId,
      details: JSON.stringify({ before, after }),
    } })
  })
}
