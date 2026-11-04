import { setupAuthorization } from '../scripts/setup-auth'

function database(user: { id: string; deletedAt: Date | null } | null) {
  const tx = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    role: { upsert: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.name })) },
    permission: { upsert: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.code })) },
    userRole: { upsert: jest.fn().mockResolvedValue({}) },
  }
  return { tx, $transaction: jest.fn(async operation => operation(tx)) }
}

test('bootstrap requires an explicitly identified existing user before changing grants', async () => {
  const db = database(null)
  await expect(setupAuthorization(db as never, '')).rejects.toThrow()
  expect(db.$transaction).not.toHaveBeenCalled()
  await expect(setupAuthorization(db as never, 'missing@example.com')).rejects.toThrow()
  expect(db.tx.role.upsert).not.toHaveBeenCalled()
  expect(db.tx.userRole.upsert).not.toHaveBeenCalled()
})

test('bootstrap refuses to promote deleted accounts', async () => {
  const db = database({ id: 'deleted', deletedAt: new Date() })
  await expect(setupAuthorization(db as never, 'deleted@example.com')).rejects.toThrow()
  expect(db.tx.userRole.upsert).not.toHaveBeenCalled()
})

test('bootstrap assigns admin only to the selected account', async () => {
  const db = database({ id: 'chosen-user', deletedAt: null })
  await setupAuthorization(db as never, 'owner@example.com')
  expect(db.tx.userRole.upsert).toHaveBeenCalledTimes(1)
  expect(db.tx.userRole.upsert).toHaveBeenCalledWith(expect.objectContaining({
    create: { userId: 'chosen-user', roleId: 'admin' },
  }))
})
