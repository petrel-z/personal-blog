/**
 * Request utilities - shared helper functions for request handling
 */

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
}

/**
 * Extract User-Agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Extract client info (IP and User-Agent) from request
 */
export function getClientInfo(request: Request) {
  return {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  }
}
