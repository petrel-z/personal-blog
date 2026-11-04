import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { Prisma, type PrismaClient } from '@prisma/client'
import { db } from './auth-fixtures'
import { setupAuthorization } from '../../scripts/setup-auth'

test.afterAll(async () => { await db.$disconnect() })

// Run the real bootstrap inside a transaction that always rolls back its fixtures and grants.
async function withRolledBackSetup(operation: (tx: Prisma.TransactionClient, bootstrap: PrismaClient) => Promise<void>) {
  const rollback = new Error('Rollback setup fixture')
  try {
    await db.$transaction(async tx => {
      const bootstrap = { $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(tx) } as PrismaClient
      await operation(tx, bootstrap)
      throw rollback
    }, { timeout: 30000 })
  } catch (error) {
    if (error !== rollback) throw error
  }
}

test('bootstrap preserves revoked and custom permissions, existing descriptions, and account passwords', async () => {
  await withRolledBackSetup(async (tx, bootstrap) => {
    const user = await tx.user.create({ data: { email: `setup-${randomUUID()}@example.com`, password: 'fixture-unchanged-password' } })
    const untouched = await tx.user.create({ data: { email: `setup-${randomUUID()}@example.com`, password: 'other-unchanged-password' } })
    const editor = await tx.role.upsert({ where: { name: 'editor' }, create: { name: 'editor' }, update: {} })
    const reviewer = await tx.role.upsert({ where: { name: 'reviewer' }, create: { name: 'reviewer' }, update: {} })
    await tx.role.update({ where: { id: editor.id }, data: { description: 'Existing role description' } })
    await tx.rolePermission.deleteMany({ where: { roleId: { in: [editor.id, reviewer.id] } } })
    const custom = await tx.permission.upsert({ where: { code: 'tag:manage' }, create: { code: 'tag:manage' }, update: {} })
    await tx.rolePermission.create({ data: { roleId: editor.id, permissionId: custom.id } })

    await setupAuthorization(bootstrap, user.email)
    await setupAuthorization(bootstrap, user.email)

    const roles = await tx.role.findMany({ where: { id: { in: [editor.id, reviewer.id] } }, include: { rolePermissions: { include: { permission: true } } } })
    expect(roles.find(role => role.name === 'editor')?.rolePermissions.map(link => link.permission.code)).toEqual(['tag:manage'])
    expect(roles.find(role => role.name === 'reviewer')?.rolePermissions).toEqual([])
    expect(roles.find(role => role.name === 'editor')?.description).toBe('Existing role description')
    expect((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe('fixture-unchanged-password')
    expect((await tx.user.findUniqueOrThrow({ where: { id: untouched.id } })).password).toBe('other-unchanged-password')
    expect(await tx.userRole.count({ where: { userId: untouched.id } })).toBe(0)
    const assigned = await tx.userRole.findMany({ where: { userId: user.id }, include: { role: true } })
    expect(assigned.map(link => link.role.name)).toEqual(['admin'])
  })
})

test('bootstrap creates missing built-in roles with their default business grants', async () => {
  await withRolledBackSetup(async (tx, bootstrap) => {
    await tx.role.deleteMany({ where: { name: { in: ['admin', 'editor', 'reviewer', 'member'] } } })
    const user = await tx.user.create({ data: { email: `setup-${randomUUID()}@example.com`, password: 'fixture-password' } })
    await setupAuthorization(bootstrap, user.email)
    const roles = await tx.role.findMany({ where: { name: { in: ['admin', 'editor', 'reviewer', 'member'] } }, include: { rolePermissions: { include: { permission: true } } } })
    expect(roles.map(role => role.name).sort()).toEqual(['admin', 'editor', 'member', 'reviewer'])
    const grants = (name: string) => roles.find(role => role.name === name)!.rolePermissions.map(link => link.permission.code).sort()
    expect(grants('editor')).toEqual(['dashboard:view', 'post:create', 'post:delete', 'post:read', 'post:update', 'upload:create'])
    expect(grants('reviewer')).toEqual(['comment:approve', 'comment:read', 'comment:reject', 'dashboard:view'])
    expect(grants('member')).toEqual([])
    expect(grants('admin')).toEqual(expect.arrayContaining(['role:read', 'role:update', 'user:create', 'user:assign-role']))
    expect(roles.every(role => role.description?.length)).toBe(true)
  })
})
