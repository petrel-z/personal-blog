import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// 生产环境数据库连接诊断
if (process.env.NODE_ENV === 'production') {
  prisma.$connect()
    .then(() => console.log('Successfully connected to production database'))
    .catch((err) => console.error('Failed to connect to production database:', err))
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
