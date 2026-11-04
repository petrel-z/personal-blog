import { editorDraftKey, readEditorDraft, writeEditorDraft, removeEditorDraft, editorCanWrite, postStatusFilter, type EditorForm } from '@/components/admin/content-editor-state'
const form: EditorForm = { title: '未保存', content: '正文', summary: '', coverImage: '', categoryId: '', tags: ['标签'], status: 'DRAFT', isPinned: false, createdAt: '' }
function memory() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } } }
test('草稿以用户和文章隔离，支持新建且保存/放弃后可删除', () => {
  const storage = memory(), key = editorDraftKey('u1', 'p1')
  expect(writeEditorDraft(() => storage, key, form)).toBe(true)
  expect(readEditorDraft(() => storage, key).draft).toEqual(form)
  expect(readEditorDraft(() => storage, editorDraftKey('u2', 'p1')).draft).toBeNull()
  expect(readEditorDraft(() => storage, editorDraftKey('u1')).draft).toBeNull()
  expect(editorDraftKey('u1')).not.toBe(editorDraftKey('u1', 'new'))
  expect(removeEditorDraft(() => storage, key)).toBe(true)
  expect(readEditorDraft(() => storage, key).draft).toBeNull()
})
test('拒绝损坏或旧格式备份，存储禁止或容量不足不抛出', () => {
  const storage = memory(); storage.setItem('key', '{broken')
  expect(readEditorDraft(() => storage, 'key').error).toBe(true)
  storage.setItem('key', JSON.stringify({ version: 1, form: { ...form, tags: [3] } }))
  expect(readEditorDraft(() => storage, 'key').draft).toBeNull()
  const denied = () => { throw new Error('SecurityError') }
  expect(readEditorDraft(denied, 'key')).toEqual({ draft: null, error: true })
  expect(writeEditorDraft(denied, 'key', form)).toBe(false)
  expect(removeEditorDraft(denied, 'key')).toBe(false)
  expect(writeEditorDraft(() => ({ ...storage, setItem: () => { throw new Error('QuotaExceededError') } }), 'key', form)).toBe(false)
})
test('已发布原始状态始终需要发布权限，不能靠草稿表单绕过', () => {
  expect(editorCanWrite(true, 'PUBLISHED', true, false)).toBe(false)
  expect(editorCanWrite(true, 'PUBLISHED', true, true)).toBe(true)
  expect(editorCanWrite(true, 'DRAFT', true, false)).toBe(true)
  expect(editorCanWrite(false, 'DRAFT', false, true)).toBe(false)
})
test('工作台链接的状态参数只接受已知值', () => {
  expect(postStatusFilter('DRAFT')).toBe('DRAFT')
  expect(postStatusFilter('DELETED')).toBe('all')
  expect(postStatusFilter(null)).toBe('all')
})
