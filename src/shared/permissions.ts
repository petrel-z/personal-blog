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
