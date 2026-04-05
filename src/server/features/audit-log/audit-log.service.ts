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

// Action types for common admin operations
export const AuditAction = {
  // Posts
  POST_CREATE: 'POST_CREATE',
  POST_UPDATE: 'POST_UPDATE',
  POST_DELETE: 'POST_DELETE',
  POST_PUBLISH: 'POST_PUBLISH',
  POST_ARCHIVE: 'POST_ARCHIVE',

  // Categories
  CATEGORY_CREATE: 'CATEGORY_CREATE',
  CATEGORY_UPDATE: 'CATEGORY_UPDATE',
  CATEGORY_DELETE: 'CATEGORY_DELETE',

  // Tags
  TAG_CREATE: 'TAG_CREATE',
  TAG_UPDATE: 'TAG_UPDATE',
  TAG_DELETE: 'TAG_DELETE',

  // Comments
  COMMENT_APPROVE: 'COMMENT_APPROVE',
  COMMENT_REJECT: 'COMMENT_REJECT',
  COMMENT_DELETE: 'COMMENT_DELETE',

  // Sensitive Words
  SENSITIVE_WORD_CREATE: 'SENSITIVE_WORD_CREATE',
  SENSITIVE_WORD_UPDATE: 'SENSITIVE_WORD_UPDATE',
  SENSITIVE_WORD_DELETE: 'SENSITIVE_WORD_DELETE',

  // Settings
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',

  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const

// Helper type for audit log creation with session
export interface CreateAuditLogParams {
  action: string
  target?: string
  details?: string
  ipAddress?: string
  userAgent?: string
}

// Helper to create audit log with user session
export async function logAdminAction(
  userId: string,
  params: CreateAuditLogParams
) {
  return createAuditLog({
    userId,
    action: params.action,
    target: params.target,
    details: params.details,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

// Overload for convenience with Request object
export async function logAdminActionWithRequest(
  userId: string,
  params: CreateAuditLogParams,
  request?: Request
) {
  const { ipAddress, userAgent } = request
    ? { ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), userAgent: request.headers.get('user-agent') }
    : { ipAddress: undefined, userAgent: undefined }

  return createAuditLog({
    userId,
    action: params.action,
    target: params.target,
    details: params.details,
    ipAddress: ipAddress || params.ipAddress,
    userAgent: userAgent || params.userAgent,
  })
}
