export const PERMISSIONS = [
  'dashboard:view',
  'post:read', 'post:create', 'post:update', 'post:delete', 'post:publish',
  'category:manage', 'tag:manage',
  'comment:read', 'comment:approve', 'comment:reject', 'comment:delete',
  'sensitive-word:manage', 'settings:update', 'user:read', 'audit:read', 'upload:create',
] as const

export type Permission = typeof PERMISSIONS[number]

export const ADMIN_PAGE_PERMISSIONS: Record<string, Permission> = {
  '/admin/dashboard': 'dashboard:view',
  '/admin/posts/new': 'post:create',
  '/admin/posts': 'post:read',
  '/admin/categories': 'category:manage',
  '/admin/tags': 'tag:manage',
  '/admin/comments': 'comment:read',
  '/admin/stats': 'dashboard:view',
  '/admin/sensitive-words': 'sensitive-word:manage',
  '/admin/settings': 'settings:update',
  '/admin/users': 'user:read',
  '/admin/audit-logs': 'audit:read',
}

export function canAccessAdminPage(permissions: readonly string[], pathname: string) {
  const entry = Object.entries(ADMIN_PAGE_PERMISSIONS).find(([path]) =>
    pathname === path || pathname.startsWith(`${path}/`))
  return !!entry && permissions.includes(entry[1])
}

/** Only canonical, authorized internal destinations may follow authentication. */
export function getPostLoginPath(permissions: readonly Permission[], callbackUrl?: string): string {
  if (callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.includes('\\')) {
    try {
      const url = new URL(callbackUrl, 'https://internal.invalid')
      // Reject encoded separators and traversal; don't turn a decoded route into a different grant.
      if (url.origin === 'https://internal.invalid' && !/%(2e|2f|5c|25)/i.test(url.pathname) &&
          canAccessAdminPage(permissions, url.pathname)) return url.pathname + url.search + url.hash
    } catch { /* Fall through to the first authorized page. */ }
  }
  return Object.entries(ADMIN_PAGE_PERMISSIONS).find(([, permission]) => permissions.includes(permission))?.[0] || '/forbidden'
}
