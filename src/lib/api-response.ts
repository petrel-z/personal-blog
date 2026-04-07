/**
 * 统一 API 响应格式
 * 符合文档规范：{ code, message, data, timestamp }
 */

// 业务状态码
export const ApiCode = {
  SUCCESS: 2000,
  CREATED: 2010,
  BAD_REQUEST: 4000,
  UNAUTHORIZED: 4010,
  FORBIDDEN: 4030,
  NOT_FOUND: 4040,
  CONFLICT: 4090,
  VALIDATION_ERROR: 4220,
  RATE_LIMITED: 4290,
  SERVER_ERROR: 5000,
  SERVICE_UNAVAILABLE: 5030,
} as const

export type ApiCodeType = typeof ApiCode[keyof typeof ApiCode]

interface ApiResponse<T = unknown> {
  code: ApiCodeType
  message: string
  data: T | null
  timestamp: number
}

interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface ApiPaginatedResponse<T> extends ApiResponse<PaginatedData<T>> {
  data: PaginatedData<T>
}

/**
 * 创建成功响应
 */
export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return {
    code: ApiCode.SUCCESS,
    message,
    data,
    timestamp: Date.now(),
  }
}

/**
 * 创建创建成功响应
 */
export function created<T>(data: T, message = '创建成功'): ApiResponse<T> {
  return {
    code: ApiCode.CREATED,
    message,
    data,
    timestamp: Date.now(),
  }
}

/**
 * 创建分页响应
 */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  message = 'success'
): ApiPaginatedResponse<T> {
  return {
    code: ApiCode.SUCCESS,
    message,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    timestamp: Date.now(),
  }
}

/**
 * 创建错误响应
 */
export function error(code: ApiCodeType, message: string, data: unknown = null): ApiResponse {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
  }
}

/**
 * 快捷错误响应
 */
export const errors = {
  badRequest: (message = '请求参数错误') => error(ApiCode.BAD_REQUEST, message),
  unauthorized: (message = '未认证') => error(ApiCode.UNAUTHORIZED, message),
  forbidden: (message = '无权限') => error(ApiCode.FORBIDDEN, message),
  notFound: (message = '资源不存在') => error(ApiCode.NOT_FOUND, message),
  conflict: (message = '资源冲突') => error(ApiCode.CONFLICT, message),
  validationError: (message = '数据验证失败') => error(ApiCode.VALIDATION_ERROR, message),
  rateLimited: (message = '请求过于频繁') => error(ApiCode.RATE_LIMITED, message),
  serverError: (message = '服务器内部错误') => error(ApiCode.SERVER_ERROR, message),
}

export type { ApiResponse, PaginatedData, ApiPaginatedResponse }
