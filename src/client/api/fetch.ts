/**
 * 统一 API 请求封装
 * 基于 fetch API，提供 get/post/put/delete/patch 方法
 * 响应格式符合文档规范：{ code, message, data, timestamp }
 */

import { ApiCode } from '@/lib/api-response'

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

interface ApiError {
  message: string
  code?: number
  errors?: Record<string, string[]>
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
  timestamp: number
}

interface PaginatedResponse<T> {
  code: number
  message: string
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  timestamp: number
}

class FetchClient {
  private baseURL: string

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: FetchOptions
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    // 处理 params
    let url = `${this.baseURL}${endpoint}`
    if (options?.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
      const query = searchParams.toString()
      if (query) url += `?${query}`
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    }

    // 移除 options 中的 params，避免传递给 fetch
    const { params, ...restOptions } = options || {}

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        ...restOptions,
      })

      const result = await response.json()

      // 检查 HTTP 状态码
      if (!response.ok) {
        return {
          code: result.code || response.status,
          message: result.message || `请求失败 (${response.status})`,
          data: null,
          timestamp: result.timestamp || Date.now(),
        }
      }

      // 检查业务状态码
      if (result.code && result.code >= 4000) {
        return {
          code: result.code,
          message: result.message || '请求失败',
          data: null,
          timestamp: result.timestamp || Date.now(),
        }
      }

      return result
    } catch (error) {
      if (error instanceof Error) {
        return {
          code: ApiCode.SERVER_ERROR,
          message: error.message || '网络错误，请检查连接',
          data: null,
          timestamp: Date.now(),
        }
      }
      return {
        code: ApiCode.SERVER_ERROR,
        message: '未知错误',
        data: null,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * GET 请求
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, { params })
  }

  /**
   * POST 请求
   */
  async post<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    return this.request<T>('POST', endpoint, data)
  }

  /**
   * PUT 请求
   */
  async put<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    return this.request<T>('PUT', endpoint, data)
  }

  /**
   * PATCH 请求
   */
  async patch<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    return this.request<T>('PATCH', endpoint, data)
  }

  /**
   * DELETE 请求
   */
  async delete<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T> | PaginatedResponse<T>> {
    return this.request<T>('DELETE', endpoint, data)
  }
}

// 导出单例
export const api = new FetchClient('/api')

// 导出类型
export type { ApiResponse, ApiError, FetchOptions, PaginatedResponse }

// 导出 ApiCode 用于成功检查
export { ApiCode }
