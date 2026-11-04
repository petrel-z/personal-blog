import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { AccessError, type Actor } from '@/server/auth/access'

/** Serialize authorization writes and recheck the operator after acquiring the shared lock. */
export async function withAdminTransaction<T>(
  actor: Actor,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!actor.isAdmin) throw new AccessError(403, '仅管理员可执行此操作')
  return prisma.$transaction(async tx => {
    const [admin] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Role WHERE name = 'admin' FOR UPDATE`
    if (!admin) throw new AccessError(403, '管理员角色不存在，请联系系统维护人员')
    const current = await tx.user.findUnique({
      where: { id: actor.id },
      select: { id: true, deletedAt: true, userRoles: { select: { roleId: true } } },
    })
    if (!current || current.deletedAt) throw new AccessError(401, '登录已失效，请重新登录')
    if (!current.userRoles.some(role => role.roleId === admin.id)) {
      throw new AccessError(403, '管理员权限已变更，请刷新页面')
    }
    return operation(tx)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 15_000 })
}
