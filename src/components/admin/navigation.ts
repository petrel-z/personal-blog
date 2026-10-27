import { canAccessAdminPage, type Permission } from '@/shared/permissions'

export const adminNavigation = [
  { label: '工作空间', items: [
    { label: '工作台', href: '/admin/dashboard', icon: 'dashboard' },
    { label: '文章管理', href: '/admin/posts', icon: 'posts' },
    { label: '分类管理', href: '/admin/categories', icon: 'categories' },
    { label: '标签管理', href: '/admin/tags', icon: 'tags' },
    { label: '评论管理', href: '/admin/comments', icon: 'comments' },
  ] },
  { label: '数据洞察', items: [
    { label: '阅读统计', href: '/admin/stats/views', icon: 'stats' },
    { label: '热门文章', href: '/admin/stats/popular', icon: 'popular' },
  ] },
  { label: '系统管理', items: [
    { label: '用户管理', href: '/admin/users', icon: 'users' },
    { label: '角色管理', href: '/admin/roles', icon: 'roles' },
    { label: '敏感词管理', href: '/admin/sensitive-words', icon: 'words' },
    { label: '审计日志', href: '/admin/audit-logs', icon: 'logs' },
    { label: '系统设置', href: '/admin/settings', icon: 'settings' },
  ] },
] as const

export function getAdminNavigation(permissions: readonly Permission[]) {
  return adminNavigation.map(group => ({ ...group,
    items: group.items.filter(item => canAccessAdminPage(permissions, item.href)),
  })).filter(group => group.items.length > 0)
}

export function getAdminBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname.startsWith('/admin/posts/')) return [
    { label: '文章管理', href: '/admin/posts' },
    { label: pathname === '/admin/posts/new' ? '新建文章' : '编辑文章' },
  ]
  const item = adminNavigation.flatMap(group => [...group.items]).find(item => item.href === pathname)
  return [{ label: item?.label ?? '管理后台' }]
}
