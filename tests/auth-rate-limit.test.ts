jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn() } }))
import { prisma } from '@/server/db'
import { consumeQuota } from '@/server/features/auth/rate-limit.service'

test('quota rejects requests past the limit and opens a new window at expiry', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-22T06:00:00Z'))
  const row = {count:0,windowStart:new Date()}
  ;(prisma.$transaction as jest.Mock).mockImplementation(async fn => fn({
    $executeRaw:async () => 1, $queryRaw:async () => [{...row}],
    authRateBucket:{update:async ({data}: {data: Partial<typeof row>}) => Object.assign(row,data)},
  }))
  try {
    expect((await consumeQuota('test',2,60)).allowed).toBe(true)
    expect((await consumeQuota('test',2,60)).allowed).toBe(true)
    expect(await consumeQuota('test',2,60)).toEqual({allowed:false,retryAfterSeconds:60})
    jest.advanceTimersByTime(60_000)
    expect(await consumeQuota('test',2,60)).toEqual({allowed:true,retryAfterSeconds:0})
  } finally {jest.useRealTimers()}
})
