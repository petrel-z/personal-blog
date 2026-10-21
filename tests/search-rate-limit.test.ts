import { SearchRateLimiter } from '@/server/features/search/search-rate-limit'

beforeEach(() => jest.useFakeTimers({ now: Date.UTC(2030, 0, 1) }))
afterEach(() => jest.useRealTimers())

test('a full limiter rejects new clients without evicting an exhausted client', () => {
  const limiter = new SearchRateLimiter(2)
  for (let i = 0; i < 60; i++) limiter.consume('first')
  expect(limiter.consume('second').allowed).toBe(true)
  expect(limiter.consume('third')).toEqual({ allowed: false, retryAfter: 60 })
  expect(limiter.consume('first').allowed).toBe(false)
  expect(limiter.consume('second').allowed).toBe(true)
})

test('expired clients free capacity without discarding a newer client quota', () => {
  const limiter = new SearchRateLimiter(2)
  limiter.consume('first')
  jest.advanceTimersByTime(20_000)
  for (let i = 0; i < 60; i++) limiter.consume('second')
  jest.advanceTimersByTime(39_001)
  expect(limiter.consume('third')).toEqual({ allowed: false, retryAfter: 1 })
  jest.advanceTimersByTime(999)
  expect(limiter.consume('third').allowed).toBe(true)
  expect(limiter.consume('second')).toEqual({ allowed: false, retryAfter: 20 })
})
