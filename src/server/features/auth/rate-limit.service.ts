import { prisma } from '@/server/db'

export async function consumeQuota(key: string, limit: number, windowSeconds: number): Promise<{allowed:boolean;retryAfterSeconds:number}> {
  if (!key || key.length > 191 || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error('Invalid quota configuration')
  }
  return prisma.$transaction(async tx => {
    const initial = new Date()
    await tx.$executeRaw`INSERT INTO AuthRateBucket (\`key\`, count, windowStart) VALUES (${key}, 0, ${initial}) ON DUPLICATE KEY UPDATE \`key\` = VALUES(\`key\`)`
    const [row] = await tx.$queryRaw<Array<{count:number;windowStart:Date}>>`
      SELECT count, windowStart FROM AuthRateBucket WHERE \`key\` = ${key} FOR UPDATE`
    const now = new Date()
    const expired = row.windowStart.getTime()+windowSeconds*1000 <= now.getTime()
    const count = expired ? 0 : row.count
    if (count >= limit) return {allowed:false,retryAfterSeconds:Math.ceil((row.windowStart.getTime()+windowSeconds*1000-now.getTime())/1000)}
    await tx.authRateBucket.update({where:{key},data:{count:count+1,windowStart:expired ? now : row.windowStart}})
    return {allowed:true,retryAfterSeconds:0}
  })
}
