/**
 * Audit Log Service - 审计日志业务逻辑
 */

import { prisma } from '@/server/db'

export async function getAuditLogs(params: {
  page?: number
  pageSize?: number
  userId?: string
  action?: string
  startDate?: Date
  endDate?: Date
}) {
  const { page = 1, pageSize = 20, userId, action, startDate, endDate } = params

  const where: any = {}
  if (userId) where.userId = userId
  if (action) where.action = action
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function createAuditLog(data: {
  userId?: string
  action: string
  target?: string
  details?: string
  ipAddress?: string
  userAgent?: string
}) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId || null,
      action: data.action,
      target: data.target || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
  })
}

export async function getAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  })
}
