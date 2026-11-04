export type EditorForm = { title: string; content: string; summary: string; coverImage: string; categoryId: string; tags: string[]; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; isPinned: boolean; createdAt: string }
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type GetStorage = () => DraftStorage
export function editorDraftKey(userId: string, articleId?: string) { return `petrel:editor-draft:v1:${JSON.stringify([userId, articleId ?? null])}` }
export function editorCanWrite(existing: boolean, originalStatus: string, canWrite: boolean, canPublish: boolean) { return canWrite && (!existing || originalStatus !== 'PUBLISHED' || canPublish) }
export function postStatusFilter(value: string | null): 'all' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' { return value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED' ? value : 'all' }
function isForm(value: unknown): value is EditorForm {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['title', 'content', 'summary', 'coverImage', 'categoryId', 'createdAt'].every(k => typeof v[k] === 'string') && Array.isArray(v.tags) && v.tags.every(t => typeof t === 'string') && typeof v.isPinned === 'boolean' && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(v.status as string)
}
export function readEditorDraft(storage: GetStorage, key: string): { draft: EditorForm | null; error: boolean } {
  try {
    const raw = storage().getItem(key)
    if (!raw) return { draft: null, error: false }
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !isForm(value.form)) return { draft: null, error: true }
    return { draft: value.form, error: false }
  } catch { return { draft: null, error: true } }
}
export function writeEditorDraft(storage: GetStorage, key: string, form: EditorForm) {
  try { storage().setItem(key, JSON.stringify({ version: 1, form })); return true } catch { return false }
}
export function removeEditorDraft(storage: GetStorage, key: string) {
  try { storage().removeItem(key); return true } catch { return false }
}
