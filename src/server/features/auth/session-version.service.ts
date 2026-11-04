import { prisma } from '@/server/db'

export function isValidSessionVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Never upgrade a token's version from the database: old credentials stay revoked. */
export async function isSessionCurrent(userId: unknown, sessionVersion: unknown): Promise<boolean> {
  if (typeof userId !== 'string' || !userId || userId.length > 191 || !isValidSessionVersion(sessionVersion)) return false
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, select: { deletedAt: true, sessionVersion: true },
    })
    return !!user && !user.deletedAt && user.sessionVersion === sessionVersion
  } catch {
    console.error('Session validation service unavailable')
    return false
  }
}
