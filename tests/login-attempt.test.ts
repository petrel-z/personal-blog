jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn() } }))
import { prisma } from '@/server/db'
import { runLoginAttempt } from '@/server/features/auth/login-attempt.service'

let row: {failures: number; lockedUntil: Date | null}
beforeEach(() => {
  row = { failures:0, lockedUntil:null }
  jest.useFakeTimers().setSystemTime(new Date('2026-10-22T06:00:00Z'))
  ;(prisma.$transaction as jest.Mock).mockImplementation(async fn => fn({
    $executeRaw: async () => 1,
    $queryRaw: async () => [{...row}],
    loginAttempt: {update: async ({data}: {data: Partial<typeof row>}) => Object.assign(row,data)},
  }))
})
afterEach(() => jest.useRealTimers())

test('fifth wrong password locks further attempts until fifteen minutes elapse', async () => {
  const wrong = jest.fn(async () => null)
  for(let i=0;i<4;i++) expect(await runLoginAttempt('key',wrong)).toEqual({kind:'invalid'})
  expect(await runLoginAttempt('key',wrong)).toEqual({kind:'locked',retryAfterSeconds:900})
  const correct = jest.fn(async () => ({id:'user'}))
  expect(await runLoginAttempt('key',correct)).toEqual({kind:'locked',retryAfterSeconds:900})
  expect(correct).not.toHaveBeenCalled()
  jest.advanceTimersByTime(900_000)
  expect(await runLoginAttempt('key',correct)).toEqual({kind:'success',user:{id:'user'}})
})

test('successful authentication clears prior failures, including unknown-email keys', async () => {
  for(let i=0;i<4;i++) await runLoginAttempt('key',async () => null)
  await runLoginAttempt('key',async () => ({id:'user'}))
  expect(await runLoginAttempt('key',async () => null)).toEqual({kind:'invalid'})
  expect(row.failures).toBe(1)
})

test('verification errors are not recorded as bad passwords', async () => {
  await expect(runLoginAttempt('key',async () => {throw new Error('db unavailable')})).rejects.toThrow('db unavailable')
  expect(row.failures).toBe(0)
})
