'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import rehypeSanitize from 'rehype-sanitize'
import { api } from '@/client/api'
import { useAuth } from '@/app/(admin)/_components'
import type { Category, Tag, PostWithRelations } from '@/shared/types'
import { uploadImage } from '@/lib/upload-image'
import { AdminBadge, AdminDialog, AdminPageHeader, AdminPanel, AdminSearch, AdminState } from './ui'
import './content-editor.css'
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
import { editorCanWrite, editorDraftKey, readEditorDraft, writeEditorDraft, removeEditorDraft, type EditorForm as Form } from './content-editor-state'
const draftStorage = () => window.sessionStorage
const empty: Form = { title: '', content: '', summary: '', coverImage: '', categoryId: '', tags: [], status: 'DRAFT', isPinned: false, createdAt: '' }
function localDate(value: string | Date) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export function ContentEditor({ id }: { id?: string }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, can, user } = useAuth()
  const [form, setForm] = useState<Form>(empty)
  const [baseline, setBaseline] = useState(JSON.stringify(empty))
  const [originalStatus, setOriginalStatus] = useState('DRAFT')
  const [recovery, setRecovery] = useState<Form | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState('')
  const discardBackup = useRef(false)
  const draftKey = user?.id ? editorDraftKey(user.id, id) : null
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [tagDialog, setTagDialog] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagBusy, setTagBusy] = useState(false)
  const [tagError, setTagError] = useState('')
  const [saved, setSaved] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(form) !== baseline
  const editable = editorCanWrite(!!id, originalStatus, can(id ? 'post:update' : 'post:create'), can('post:publish'))
  const readOnlyReason = id && originalStatus === 'PUBLISHED' && !can('post:publish') ? '这篇文章已发布。修改已发布文章需要发布权限，当前以只读方式打开，仍可预览正文。' : '当前账号没有编辑这篇文章的权限，仍可预览正文。'
  const load = useCallback(async () => {
    setLoading(true); setLoadError(''); setDraftReady(false)
    try {
      const [cs, ts, ps] = await Promise.all([api.get('/categories'), api.get('/tags'), id ? api.get(`/posts/${id}`) : Promise.resolve(null)])
      for (const result of [cs, ts, ...(ps ? [ps] : [])]) if (result.code !== 2000 || !result.data) throw new Error(result.message || '加载文章数据失败')
      setCategories(cs.data as unknown as Category[]); setTags(ts.data as unknown as Tag[])
      if (ps) {
        const p = ps.data as unknown as PostWithRelations & { isPinned?: boolean }
        const next: Form = { title: p.title, content: p.content || '', summary: p.summary || '', coverImage: p.coverImage || '', categoryId: p.category?.id || '', tags: p.tags.map(t => t.name), status: p.status === 'DELETED' ? 'ARCHIVED' : p.status, isPinned: !!p.isPinned, createdAt: p.createdAt ? localDate(p.createdAt) : '' }
        setForm(next); setBaseline(JSON.stringify(next)); setOriginalStatus(p.status)
      } else { setForm(empty); setBaseline(JSON.stringify(empty)); setOriginalStatus('DRAFT') }
      if (draftKey) {
        const backup = readEditorDraft(draftStorage, draftKey)
        setRecovery(backup.draft)
        if (backup.error) setStorageWarning('无法读取本标签页的草稿备份，服务器内容未被更改。')
      }
      setDraftReady(true)
    } catch (e) { setLoadError(e instanceof Error ? e.message : '加载失败，请重试') } finally { setLoading(false) }
  }, [id, draftKey])
  useEffect(() => { if (!authLoading && isAuthenticated) void load() }, [authLoading, isAuthenticated, load])
  useEffect(() => {
    if (!draftReady || loading || recovery || !draftKey || !editable || discardBackup.current || !dirty) return
    if (!writeEditorDraft(draftStorage, draftKey, form)) setStorageWarning('浏览器无法备份草稿（存储可能已满或被禁用）。请及时保存；后退后可能无法恢复。')
  }, [draftReady, loading, recovery, draftKey, editable, dirty, form])
  function clearBackup() {
    if (draftKey && !removeEditorDraft(draftStorage, draftKey)) setStorageWarning('无法清除浏览器草稿备份；再次打开时请勿恢复已放弃的旧备份。')
  }
  useEffect(() => {
    if (!dirty) return
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const navigate = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor || anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      const target = new URL(anchor.href, location.href)
      if (target.href === location.href || target.protocol !== 'http:' && target.protocol !== 'https:') return
      e.preventDefault(); e.stopPropagation(); setLeaveTarget(target.href)
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty])
  function update<K extends keyof Form>(key: K, value: Form[K]) { if (!editable || recovery) return; setForm(prev => ({ ...prev, [key]: value })); setSaved(false) }
  async function save(publish: boolean) {
    if (!editable || recovery || busy || uploading || (publish || form.status === 'PUBLISHED') && !can('post:publish')) return
    if (!form.title.trim() || !form.content.trim()) { setError('请填写文章标题和正文。'); return }
    setBusy(true); setError('')
    try {
      const { createdAt, ...fields } = form
      const status = publish ? 'PUBLISHED' : form.status
      const data = { ...fields, status, categoryId: form.categoryId || (id ? null : undefined), ...(createdAt ? { createdAt: new Date(createdAt).toISOString() } : {}) }
      const result = id ? await api.patch(`/posts/${id}`, data) : await api.post('/posts', data)
      if (![2000, 2010].includes(result.code)) throw new Error(result.message || '保存失败，请重试')
      const next = { ...form, status } as Form
      setForm(next); setBaseline(JSON.stringify(next)); setOriginalStatus(status); setSaved(true); clearBackup()
      if (!id) router.push(`/admin/posts/${(result.data as { id: string }).id}`)
    } catch (e) { setError(e instanceof Error ? e.message : '网络错误，请重试；当前输入已保留。') } finally { setBusy(false) }
  }
  function toggleTag(name: string) { update('tags', form.tags.includes(name) ? form.tags.filter(t => t !== name) : [...form.tags, name]) }
  async function createTag() {
    if (!tagName.trim() || tagBusy || !can('tag:manage')) return
    setTagBusy(true); setTagError('')
    try {
      const result = await api.post('/tags', { name: tagName.trim(), slug: tagName.trim().toLowerCase().replace(/\s+/g, '-') })
      if (![2000, 2010].includes(result.code)) throw new Error(result.message || '创建标签失败')
      const tag = result.data as unknown as Tag
      setTags(prev => [...prev.filter(t => t.id !== tag.id), tag]); update('tags', Array.from(new Set([...form.tags, tag.name]))); setTagName('')
    } catch (e) { setTagError(e instanceof Error ? e.message : '创建失败，请重试') } finally { setTagBusy(false) }
  }
  async function upload(file: File | undefined, cover: boolean) {
    if (!file || uploading || !editable) return
    if (!file.type.startsWith('image/')) { setError('请选择图片文件。'); return }
    setUploading(true); setError('')
    try {
      const url = await uploadImage(file)
      setForm(prev => cover ? { ...prev, coverImage: url } : { ...prev, content: `${prev.content}\n\n![${file.name.replace(/[\[\]]/g, '')}](${url})` }); setSaved(false)
    } catch (e) { setError(e instanceof Error ? e.message : '图片上传失败，请重试') } finally { setUploading(false); if (coverInput.current) coverInput.current.value = ''; if (imageInput.current) imageInput.current.value = '' }
  }
  if (loading || authLoading) return <AdminState kind="loading" title="正在打开编辑器…" />
  if (loadError) return <AdminState kind="error" description={loadError} onRetry={load} />
  return <div className="content-editor space-y-6">
    <button className="admin-btn admin-btn-ghost" onClick={() => dirty ? setLeaveTarget('/admin/posts') : router.push('/admin/posts')}>← 返回文章列表</button>
    <AdminPageHeader title={id ? '编辑文章' : '新建文章'} description={dirty ? '有未保存的修改' : saved ? '文章已保存' : '让想法成为文字。'} actions={<><AdminBadge tone={form.status === 'PUBLISHED' ? 'success' : 'warning'}>{form.status === 'PUBLISHED' ? '已发布' : form.status === 'ARCHIVED' ? '已归档' : '草稿'}</AdminBadge><button className="admin-btn admin-btn-secondary" onClick={() => setPreview(!preview)}>{preview ? '返回编辑' : '预览'}</button>{editable && <button className="admin-btn admin-btn-secondary" disabled={busy || uploading} onClick={() => save(false)}>{busy ? '保存中…' : form.status === 'DRAFT' ? '保存草稿' : '保存'}</button>}{editable && can('post:publish') && form.status !== 'PUBLISHED' && <button className="admin-btn admin-btn-primary" disabled={busy || uploading} onClick={() => save(true)}>发布文章</button>}</>} />
    {!editable && <p className="admin-notice admin-notice-warning" role="status">{readOnlyReason}</p>}
    {storageWarning && <p className="admin-notice admin-notice-warning" role="status">{storageWarning}</p>}
    {editable && !storageWarning && <p className="text-xs text-muted-foreground">未保存的修改会备份在本浏览器标签页；再次打开时可选择恢复，不会自动覆盖服务器文章。</p>}
    {error && <p className="admin-notice admin-notice-error" role="alert">{error}</p>}
    {uploading && <p className="admin-notice" role="status">图片上传中，请稍候…</p>}
    <fieldset disabled={!editable || busy || !!recovery} className="content-editor-layout">
      <AdminPanel title="正文" actions={<div className="admin-tabs" role="tablist" aria-label="正文视图"><button role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>编辑</button><button role="tab" aria-selected={preview} onClick={() => setPreview(true)}>预览</button></div>}>
        <div className="content-editor-title"><label className="sr-only" htmlFor="post-title">文章标题</label><input id="post-title" maxLength={200} placeholder="请输入文章标题" value={form.title} onChange={e => update('title', e.target.value)} /></div>
        <div data-color-mode="light" onPaste={e => { const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/')); if (file) { e.preventDefault(); void upload(file, false) } }} onDragOver={e => e.preventDefault()} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); void upload(e.dataTransfer.files[0], false) } }}>
          <MDEditor value={form.content} onChange={v => update('content', v || '')} height={580} preview={preview ? 'preview' : 'edit'} previewOptions={{ rehypePlugins: [rehypeSanitize] }} textareaProps={{ 'aria-label': '文章正文', placeholder: '开始写作，支持 Markdown…' }} />
        </div><div className="content-editor-footer"><button className="admin-btn admin-btn-ghost" disabled={uploading} onClick={() => imageInput.current?.click()}>＋ 插入图片</button><span>{form.content.length} 字 · 约 {Math.max(1, Math.ceil(form.content.length / 400))} 分钟</span></div>
        <input ref={imageInput} type="file" accept="image/*" hidden onChange={e => void upload(e.target.files?.[0], false)} />
      </AdminPanel>
      <AdminPanel title="文章设置"><div className="content-editor-settings admin-form">
        <div className="admin-field"><span>封面图片</span><button type="button" className="content-cover" disabled={uploading} onClick={() => coverInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0], true) }}>{form.coverImage ? <Image src={form.coverImage} alt="文章封面" width={640} height={360} unoptimized /> : <><span>＋ 上传封面图片</span><small>建议 16:9 · JPG / PNG / WebP</small></>}</button><input ref={coverInput} type="file" accept="image/*" hidden onChange={e => void upload(e.target.files?.[0], true)} />{form.coverImage && <button className="admin-btn admin-btn-ghost" onClick={() => update('coverImage', '')}>移除封面</button>}</div>
        <label className="admin-field">封面地址<input type="url" placeholder="https://…" value={form.coverImage} onChange={e => update('coverImage', e.target.value)} /></label>
        <label className="admin-field">文章分类<select value={form.categoryId} onChange={e => update('categoryId', e.target.value)}><option value="">未分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="admin-field"><span>文章标签</span><div className="content-tag-list">{form.tags.map(t => <button className="content-tag" key={t} aria-label={`移除标签 ${t}`} onClick={() => toggleTag(t)}>{t} ×</button>)}<button className="admin-btn admin-btn-ghost" onClick={() => { setTagDialog(true); setTagError('') }}>＋ 添加</button></div></div>
        <label className="admin-field">文章摘要<textarea rows={4} maxLength={500} value={form.summary} placeholder="用几句话介绍这篇文章…" onChange={e => update('summary', e.target.value)} /><small>{form.summary.length} / 500</small></label>
        <label className="content-pin"><span>置顶文章</span><input type="checkbox" checked={form.isPinned} onChange={e => update('isPinned', e.target.checked)} /></label>
        {id && <label className="admin-field">文章状态<select value={form.status} onChange={e => update('status', e.target.value as Form['status'])}><option value="DRAFT">草稿</option>{(can('post:publish') || form.status === 'PUBLISHED') && <option value="PUBLISHED">已发布</option>}<option value="ARCHIVED">归档</option></select></label>}
        <label className="admin-field">创建时间<input type="datetime-local" value={form.createdAt} onChange={e => update('createdAt', e.target.value)} /><small>留空使用默认时间。</small></label>
      </div></AdminPanel>
    </fieldset>
    <div className="content-editor-mobile-actions"><button className="admin-btn admin-btn-secondary" onClick={() => setPreview(!preview)}>{preview ? '编辑' : '预览'}</button>{editable && <button className="admin-btn admin-btn-secondary" disabled={busy || uploading} onClick={() => save(false)}>{busy ? '保存中…' : form.status === 'DRAFT' ? '保存草稿' : '保存'}</button>}{editable && can('post:publish') && form.status !== 'PUBLISHED' && <button className="admin-btn admin-btn-primary" disabled={busy || uploading} onClick={() => save(true)}>发布文章</button>}</div>
    <AdminDialog open={!!recovery} onClose={() => {}} title="发现未保存的草稿" description="本标签页保存了此账号对此文章的未保存修改。恢复只会填入编辑器，点击保存后才会更新服务器。" busy><div className="admin-dialog-footer"><button className="admin-btn admin-btn-secondary" onClick={() => { clearBackup(); setRecovery(null) }}>放弃备份，使用服务器内容</button><button className="admin-btn admin-btn-primary" disabled={!editable} onClick={() => { if (recovery && editable) { setForm(recovery); setSaved(false); setRecovery(null) } }}>恢复草稿</button></div>{!editable && <p className="admin-notice">{readOnlyReason}</p>}</AdminDialog>
    <AdminDialog open={tagDialog} onClose={() => setTagDialog(false)} title="选择文章标签" description="可选择多个标签，也可以创建新标签。" busy={tagBusy}><div className="admin-form"><AdminSearch value={tagSearch} onChange={setTagSearch} placeholder="搜索标签…" /><div className="content-tag-options">{tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase())).map(t => <label key={t.id}><input type="checkbox" checked={form.tags.includes(t.name)} onChange={() => toggleTag(t.name)} />{t.name}</label>)}{!tags.some(t => t.name.toLowerCase().includes(tagSearch.toLowerCase())) && <p>没有匹配的标签</p>}</div>{tagError && <p role="alert" className="admin-notice admin-notice-error">{tagError}</p>}{can('tag:manage') && <><label className="admin-field">创建新标签<input maxLength={20} value={tagName} onChange={e => setTagName(e.target.value)} placeholder="输入标签名称" /></label><button className="admin-btn admin-btn-secondary" disabled={tagBusy || !tagName.trim()} onClick={createTag}>{tagBusy ? '创建中…' : '创建并选中'}</button></>}<div className="admin-dialog-footer"><button className="admin-btn admin-btn-primary" disabled={tagBusy} onClick={() => setTagDialog(false)}>完成 · 已选 {form.tags.length} 个</button></div></div></AdminDialog>
    <AdminDialog open={!!leaveTarget} onClose={() => setLeaveTarget(null)} title="离开编辑器？" description="当前修改尚未保存。离开后，这些修改将丢失。"><div className="admin-dialog-footer"><button className="admin-btn admin-btn-secondary" onClick={() => setLeaveTarget(null)}>继续编辑</button><button className="admin-btn admin-btn-danger" onClick={() => { const target = leaveTarget!; discardBackup.current = true; clearBackup(); setBaseline(JSON.stringify(form)); setLeaveTarget(null); router.push(target) }}>放弃修改并离开</button></div></AdminDialog>
  </div>
}
