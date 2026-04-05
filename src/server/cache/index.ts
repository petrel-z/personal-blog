import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Cache keys
export const CACHE_KEYS = {
  postView: (postId: string, ipHash: string) => `post:view:${postId}:${ipHash}`,
  postViews: (postId: string) => `post:views:${postId}`,
  postLike: (postId: string, ipHash: string) => `post:like:${postId}:${ipHash}`,
  postLikes: (postId: string) => `post:likes:${postId}`,
  commentRate: (ipHash: string) => `comment:rate:${ipHash}`,
  loginFail: (email: string) => `login:fail:${email}`,
  postsHome: (page: number, pageSize: number) => `cache:posts:home:${page}:${pageSize}`,
  postsTrending: (timeframe: string) => `cache:posts:trending:${timeframe}`,
  categories: 'cache:categories',
  tags: 'cache:tags',
} as const

// Cache TTL (in seconds)
export const CACHE_TTL = {
  postView: 600,      // 10 minutes
  postLike: -1,       // Permanent (once liked)
  commentRate: 60,     // 1 minute
  loginFail: 900,     // 15 minutes
  postsHome: 600,     // 10 minutes
  postsTrending: 600,  // 10 minutes
  categories: 3600,   // 1 hour
  tags: 3600,         // 1 hour
} as const
