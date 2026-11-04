import type { ReactElement } from 'react'
let states: unknown[] = []
let cursor = 0
let effects: (() => void)[] = []
let initialized = false
jest.mock('react', () => ({ ...jest.requireActual('react'),
  useState: (initial: unknown) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value: unknown) => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => { if (!initialized) effects.push(effect) },
}))
jest.mock('@/client/api', () => ({ api: { get: jest.fn(), put: jest.fn(), post: jest.fn() } }))
jest.mock('@/app/(admin)/_components', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, can: () => true }) }))
import { api } from '@/client/api'
import SettingsPage from '@/app/(admin)/admin/settings/page'
import SensitiveWordsPage from '@/app/(admin)/admin/sensitive-words/page'
import AuditLogsPage from '@/app/(admin)/admin/audit-logs/page'
function render(component: () => ReactElement) { cursor = 0; return component() }
function nodes(node: unknown): ReactElement<any>[] { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); const element = node as ReactElement<any>; return [element, ...nodes(element.props?.children)] }
async function load(component: () => ReactElement) { render(component); initialized = true; effects.forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); return nodes(render(component)) }
beforeEach(() => { states = []; cursor = 0; effects = []; initialized = false; jest.clearAllMocks() })
for (const [name, Page] of [['设置', SettingsPage], ['敏感词', SensitiveWordsPage], ['日志', AuditLogsPage]] as const) {
  test(`${name} API拒绝时显示可重试错误而非空数据`, async () => {
    ;(api.get as jest.Mock).mockResolvedValue({ code: 5000, message: '服务暂不可用' })
    const tree = await load(Page)
    expect(tree.some(node => node.props?.kind === 'error' && typeof node.props.onRetry === 'function')).toBe(true)
  })
}
test('设置切换分组保留草稿并一次提交所有八个字段', async () => {
  const original = { blogName: '原名称', blogDescription: '描述', blogKeywords: '关键词', ogImage: '', githubUrl: '', twitterUrl: '', autoApproveComments: false, requireEmailForComments: true }
  ;(api.get as jest.Mock).mockResolvedValue({ code: 2000, data: original })
  ;(api.put as jest.Mock).mockResolvedValue({ code: 2000 })
  let tree = await load(SettingsPage)
  const input = tree.find(node => node.type === 'input' && node.props.value === '原名称')!
  input.props.onChange({ target: { value: '未保存名称' } })
  tree = nodes(render(SettingsPage))
  const social = tree.find(node => node.props?.role === 'tab' && node.props.children === '社交链接')
  expect(social).toBeDefined()
  social!.props.onClick()
  tree = nodes(render(SettingsPage))
  const form = tree.find(node => node.type === 'form')!
  await form.props.onSubmit({ preventDefault() {} })
  expect(api.put).toHaveBeenCalledWith('/settings', { ...original, blogName: '未保存名称' })
})
test('敏感词创建接受2010并关闭表单', async () => {
  ;(api.get as jest.Mock).mockResolvedValue({ code: 2000, data: { items: [], total: 0, totalPages: 1 } })
  ;(api.post as jest.Mock).mockResolvedValue({ code: 2010, data: { id: 'new' } })
  let tree = await load(SensitiveWordsPage)
  const header = tree.find(node => node.props?.title === '敏感词管理')
  const add = header ? nodes(header.props.actions).find(node => node.type === 'button') : tree.find(node => node.type === 'button' && node.props.children === '添加敏感词')
  add!.props.onClick()
  tree = nodes(render(SensitiveWordsPage))
  await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} })
  tree = nodes(render(SensitiveWordsPage))
  expect(tree.some(node => node.type === 'form')).toBe(false)
})
test('敏感词提供接口分页以访问第一页以外记录', async () => {
  ;(api.get as jest.Mock).mockResolvedValue({ code: 2000, data: { items: [], total: 35, totalPages: 2 } })
  let tree = await load(SensitiveWordsPage)
  const pagination = tree.find(node => node.props?.totalPages === 2 && typeof node.props.onPageChange === 'function')
  expect(pagination).toBeDefined()
  pagination!.props.onPageChange(2)
  effects = []; initialized = false
  render(SensitiveWordsPage)
  initialized = true; effects.forEach(effect => effect())
  await new Promise(resolve => setImmediate(resolve))
  expect(api.get).toHaveBeenLastCalledWith('/sensitive-words', { page: 2, pageSize: 20 })
})
test('敏感词保存失败保留输入并展示错误', async () => {
  ;(api.get as jest.Mock).mockResolvedValue({ code: 2000, data: { items: [], total: 0, totalPages: 1 } })
  ;(api.post as jest.Mock).mockResolvedValue({ code: 5000, message: '保存暂不可用' })
  let tree = await load(SensitiveWordsPage)
  const header = tree.find(node => node.props?.title === '敏感词管理')!
  nodes(header.props.actions).find(node => node.type === 'button')!.props.onClick()
  tree = nodes(render(SensitiveWordsPage))
  tree.find(node => node.props?.id === 'sensitive-word')!.props.onChange({ target: { value: '待保存词汇' } })
  tree = nodes(render(SensitiveWordsPage))
  await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} })
  tree = nodes(render(SensitiveWordsPage))
  expect(tree.find(node => node.props?.id === 'sensitive-word')!.props.value).toBe('待保存词汇')
  expect(tree.some(node => node.props?.role === 'alert' && node.props.children === '保存暂不可用')).toBe(true)
})
