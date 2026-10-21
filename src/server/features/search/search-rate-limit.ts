import { isIP } from 'node:net'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
type ClientWindows = Map<string, { count: number; resetAt: number }>

/** Fixed windows for the current single-process deployment; rejected requests never extend them. */
export class SearchRateLimiter {
  constructor(
    private readonly maxClients = 10_000,
    private readonly clients: ClientWindows = new Map(),
  ) {}

  consume(client: string) {
    const now = Date.now()
    // Entries have a fixed expiry and are inserted in expiry order. No background timer is needed.
    const entries = this.clients.entries()
    let oldestEntry = entries.next()
    while (!oldestEntry.done && oldestEntry.value[1].resetAt <= now) {
      this.clients.delete(oldestEntry.value[0])
      oldestEntry = entries.next()
    }

    let entry = this.clients.get(client)
    if (!entry) {
      if (this.clients.size >= this.maxClients) {
        const oldest = this.clients.values().next().value!
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest.resetAt - now) / 1000)) }
      }
      entry = { count: 0, resetAt: now + WINDOW_MS }
      this.clients.set(client, entry)
    }
    if (entry.count >= MAX_REQUESTS) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
    }
    entry.count += 1 // Synchronous: concurrent route calls reserve quota before awaiting the database.
    return { allowed: true, retryAfter: 0 }
  }
}

function clientKey(request: Request) {
  // Only enable behind an ingress that overwrites X-Real-IP and blocks direct access to Next.js.
  if (process.env.SEARCH_TRUST_PROXY !== 'true') return 'unknown'
  const ip = request.headers.get('x-real-ip')?.trim() ?? ''
  if (isIP(ip) === 4) return ip
  if (isIP(ip) === 6) {
    try {
      const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
      const mapped = normalized.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/)
      if (mapped) {
        const high = parseInt(mapped[1], 16)
        const low = parseInt(mapped[2], 16)
        return [high >> 8, high & 255, low >> 8, low & 255].join('.')
      }
      return normalized
    } catch { /* Invalid URL forms, including scoped IPv6, use the shared fallback. */ }
  }
  return 'unknown'
}

// Keep counters across development reloads, but recreate behavior so policy edits take effect.
const globalForSearch = globalThis as unknown as { blogSearchRateLimiter?: { clients: ClientWindows } }
const clients = globalForSearch.blogSearchRateLimiter?.clients ?? new Map()
globalForSearch.blogSearchRateLimiter = { clients }
const limiter = new SearchRateLimiter(10_000, clients)

export function consumeSearchRequest(request: Request) {
  return limiter.consume(clientKey(request))
}
