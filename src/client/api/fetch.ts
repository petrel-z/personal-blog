/**
 * 统一 API 请求封装
 * 基于 fetch API，提供 get/post/put/delete/patch 方法
 */

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
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
  ): Promise<ApiResponse<T>> {
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

      if (!response.ok) {
        return {
          success: false,
          error: result.error || `请求失败 (${response.status})`,
          ...result,
        }
      }

      return result
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message || '网络错误，请检查连接',
        }
      }
      return {
        success: false,
        error: '未知错误',
      }
    }
  }

  /**
   * GET 请求
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, { params })
  }

  /**
   * POST 请求
   */
  async post<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data)
  }

  /**
   * PUT 请求
   */
  async put<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data)
  }

  /**
   * PATCH 请求
   */
  async patch<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, data)
  }

  /**
   * DELETE 请求
   */
  async delete<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, data)
  }
}

// 导出单例
export const api = new FetchClient('/api')

// 导出类型
export type { ApiResponse, ApiError, FetchOptions }
