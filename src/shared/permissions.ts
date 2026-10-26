interface PermissionDefinition {
  label: string
  group: string
  adminOnly?: boolean
}

export const PERMISSION_DEFINITIONS = {
  'dashboard:view': { label: '查看仪表盘与统计', group: '仪表盘' },
  'post:read': { label: '查看文章', group: '文章' },
  'post:create': { label: '创建文章', group: '文章' },
  'post:update': { label: '编辑文章', group: '文章' },
  'post:delete': { label: '删除文章', group: '文章' },
  'post:publish': { label: '发布文章', group: '文章' },
  'category:manage': { label: '管理分类', group: '分类与标签' },
  'tag:manage': { label: '管理标签', group: '分类与标签' },
  'comment:read': { label: '查看评论', group: '评论' },
  'comment:approve': { label: '通过评论', group: '评论' },
  'comment:reject': { label: '拒绝评论', group: '评论' },
  'comment:delete': { label: '删除评论', group: '评论' },
  'sensitive-word:manage': { label: '管理敏感词', group: '内容审核' },
  'settings:update': { label: '修改系统设置', group: '系统' },
  'user:read': { label: '查看用户', group: '用户与角色' },
  'audit:read': { label: '查看审计日志', group: '系统' },
  'upload:create': { label: '上传文件', group: '文件' },
  'role:read': { label: '查看角色详情', group: '用户与角色', adminOnly: true },
  'role:update': { label: '配置角色权限', group: '用户与角色', adminOnly: true },
  'user:create': { label: '创建后台用户', group: '用户与角色', adminOnly: true },
  'user:assign-role': { label: '分配用户角色', group: '用户与角色', adminOnly: true },
} as const satisfies Record<string, PermissionDefinition>

export type Permission = keyof typeof PERMISSION_DEFINITIONS
export const PERMISSIONS = Object.keys(PERMISSION_DEFINITIONS) as readonly Permission[]

export function isAdminPermission(permission: Permission): boolean {
  const definition: PermissionDefinition = PERMISSION_DEFINITIONS[permission]
  return definition.adminOnly === true
}

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
  '/admin/roles': 'role:read',
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
