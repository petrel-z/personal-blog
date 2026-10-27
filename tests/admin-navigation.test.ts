import { getAdminBreadcrumbs, getAdminNavigation } from '@/components/admin/navigation'

test('中文面包屑保留文章父级并识别任意编辑 ID', () => {
  expect(getAdminBreadcrumbs('/admin/posts/123')).toEqual([
    { label: '文章管理', href: '/admin/posts' }, { label: '编辑文章' },
  ])
  expect(getAdminBreadcrumbs('/admin/posts/new').at(-1)?.label).toBe('新建文章')
  expect(getAdminBreadcrumbs('/admin/stats/views')).toEqual([{ label: '阅读统计' }])
})

test('按权限显示分组，隐藏无权访问的页面及空分组', () => {
  const groups = getAdminNavigation(['comment:read'])
  expect(groups).toHaveLength(1)
  expect(groups[0].items.map(item => item.href)).toEqual(['/admin/comments'])
  expect(getAdminNavigation([])).toEqual([])
})

test('未知路径不显示 ID 或错误的可点击面包屑', () => {
  expect(getAdminBreadcrumbs('/admin/not-a-real-page')).toEqual([{ label: '管理后台' }])
})
