import { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../src/shared/permissions'
import { ROLE_DEFINITIONS } from '../src/shared/roles'

class SetupInputError extends Error {}

/** Only a server operator can run this; registration never calls it. */
export async function setupAuthorization(db: PrismaClient, adminEmail: string) {
  const email = adminEmail.trim()
  if (!email) throw new SetupInputError('请用 --admin-email 明确指定一个已注册账号。')

  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } })
    if (!user || user.deletedAt) throw new SetupInputError('指定账号不存在或已删除，未修改任何权限。')

    const permissionIds = new Map<string, string>()
    for (const code of PERMISSIONS) {
      const permission = await tx.permission.upsert({ where: { code }, create: { code }, update: {} })
      permissionIds.set(code, permission.id)
    }
    let adminRoleId = ''
    for (const [name, definition] of Object.entries(ROLE_DEFINITIONS)) {
      const role = await tx.role.upsert({
        where: { name },
        create: {
          name,
          description: definition.description,
          // Nested creates run only for a missing role; existing grants remain untouched.
          rolePermissions: {
            create: definition.defaultPermissions.map(code => ({ permissionId: permissionIds.get(code)! })),
          },
        },
        update: {},
      })
      if (name === 'admin') adminRoleId = role.id
    }
    const userId_roleId = { userId: user.id, roleId: adminRoleId }
    await tx.userRole.upsert({ where: { userId_roleId }, create: userId_roleId, update: {} })
    return user.id
  }, { timeout: 30000 })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: pnpm auth:setup --admin-email <existing-account-email>')
    return
  }
  if (args.length !== 2 || args[0] !== '--admin-email' || !args[1].trim()) {
    throw new SetupInputError('Usage: pnpm auth:setup --admin-email <existing-account-email>')
  }
  const db = new PrismaClient()
  try {
    await setupAuthorization(db, args[1])
    console.log('角色和权限初始化完成，指定账号已获得管理员权限。')
  } finally {
    await db.$disconnect()
  }
}

if (require.main === module) {
  main().catch(error => {
    // Avoid printing connection strings or database diagnostics containing secrets.
    console.error(error instanceof SetupInputError ? error.message : '权限初始化失败，请检查数据库连接和账号。')
    process.exitCode = 1
  })
}
