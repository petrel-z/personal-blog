import { prisma } from '@/server/db'
import { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_WINDOW } from '@/shared/constants'

type LoginResult<T> = {kind:'success';user:T} | {kind:'invalid'} | {kind:'locked';retryAfterSeconds:number}

/** Hold one per-email row lock across verification, count updates and lockout checks. */
export async function runLoginAttempt<T>(key: string, verify: () => Promise<T | null>): Promise<LoginResult<T>> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO LoginAttempt (\`key\`, failures) VALUES (${key}, 0) ON DUPLICATE KEY UPDATE \`key\` = VALUES(\`key\`)`
    const [row] = await tx.$queryRaw<Array<{failures:number;lockedUntil:Date | null}>>`
      SELECT failures, lockedUntil FROM LoginAttempt WHERE \`key\` = ${key} FOR UPDATE`
    const now = Date.now()
    if (row.lockedUntil && row.lockedUntil.getTime() > now) {
      return {kind:'locked',retryAfterSeconds:Math.ceil((row.lockedUntil.getTime()-now)/1000)}
    }
    const user = await verify()
    if (user) {
      await tx.loginAttempt.update({where:{key},data:{failures:0,lockedUntil:null}})
      return {kind:'success',user}
    }
    const failures = (row.lockedUntil ? 0 : row.failures) + 1
    const lockedUntil = failures >= LOGIN_MAX_ATTEMPTS ? new Date(Date.now()+LOGIN_LOCKOUT_WINDOW*1000) : null
    await tx.loginAttempt.update({where:{key},data:{failures,lockedUntil}})
    // Return, rather than throw, so failed-password counts are committed.
    return lockedUntil ? {kind:'locked',retryAfterSeconds:LOGIN_LOCKOUT_WINDOW} : {kind:'invalid'}
  }, {maxWait:10_000,timeout:15_000})
}
