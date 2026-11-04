'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '@/app/(admin)/_components'
import { AdminDialog, AdminPageHeader, AdminPanel, AdminSearch, AdminState } from './ui'

type Item = { id: string; name: string; slug: string; description?: string | null; postCount?: number }
export function ContentTaxonomy({ kind }: { kind: 'categories' | 'tags' }) {
  const label = kind === 'categories' ? '分类' : '标签'
  const { isAuthenticated, isLoading: authLoading, can } = useAuth()
  const allowed = can(kind === 'categories' ? 'category:manage' : 'tag:manage')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await api.get(`/${kind}`)
      if (result.code !== 2000 || !Array.isArray(result.data)) throw new Error(result.message || `获取${label}失败`)
      setItems(result.data as Item[])
    } catch (e) { setError(e instanceof Error ? e.message : '网络错误，请重试') }
    finally { setLoading(false) }
  }, [kind, label])
  useEffect(() => { if (!authLoading && isAuthenticated) void load() }, [authLoading, isAuthenticated, load])
  function open(item: Item | null) {
    setEditing(item); setForm({ name: item?.name || '', slug: item?.slug || '', description: item?.description || '' }); setFormError(''); setDialog(true)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!allowed || busy) return
    setBusy(true); setFormError('')
    try {
      const data = kind === 'tags' ? { name: form.name.trim(), slug: form.slug.trim() } : { ...form, name: form.name.trim(), slug: form.slug.trim() }
      const result = editing ? await api.put(`/${kind}/${editing.id}`, data) : await api.post(`/${kind}`, data)
      if (![2000, 2010].includes(result.code)) throw new Error(result.message || '保存失败')
      setDialog(false); void load()
    } catch (e) { setFormError(e instanceof Error ? e.message : '保存失败，请重试') } finally { setBusy(false) }
  }
  async function remove() {
    if (!deleting || !allowed || busy) return
    setBusy(true); setFormError('')
    try {
      const result = await api.delete(`/${kind}/${deleting.id}`)
      if (result.code !== 2000) throw new Error(result.message || '删除失败')
      setDeleting(null); void load()
    } catch (e) { setFormError(e instanceof Error ? e.message : '删除失败，请重试') } finally { setBusy(false) }
  }
  const visible = items.filter(item => `${item.name} ${item.slug}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-6">
    <AdminPageHeader title={`${label}管理`} description={`整理内容，让每篇文章都有迹可循 · 共 ${items.length} 个${label}`} actions={allowed && <button className="admin-btn admin-btn-primary" onClick={() => open(null)}>＋ 新建{label}</button>} />
    <AdminPanel><div className="admin-toolbar"><AdminSearch value={search} onChange={setSearch} placeholder={`搜索${label}名称或 Slug`} /></div>
      {loading || authLoading ? <AdminState kind="loading" /> : error ? <AdminState kind="error" description={error} onRetry={load} /> : !visible.length ? <AdminState kind="empty" title={search ? '没有匹配结果' : `暂无${label}`} description={search ? '尝试其他关键词。' : `新建${label}，开始整理文章。`} /> : <div className="admin-table-wrap"><table className="admin-table admin-table-mobile"><thead><tr><th>名称</th><th>Slug</th>{kind === 'categories' && <th>描述</th>}<th>文章数</th><th>操作</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td data-label="名称"><strong>{kind === 'tags' ? '# ' : ''}{item.name}</strong></td><td data-label="Slug"><code>{item.slug}</code></td>{kind === 'categories' && <td data-label="描述">{item.description || '—'}</td>}<td data-label="文章数">{item.postCount ?? 0}</td><td data-label="操作">{allowed && <div className="admin-row-actions"><button className="admin-btn admin-btn-ghost" onClick={() => open(item)}>编辑</button><button className="admin-btn admin-btn-danger" onClick={() => { setDeleting(item); setFormError('') }}>删除</button></div>}</td></tr>)}</tbody></table></div>}
    </AdminPanel>
    <AdminDialog open={dialog} onClose={() => setDialog(false)} title={`${editing ? '编辑' : '新建'}${label}`} description="名称用于展示，Slug 用于链接地址。" busy={busy}>
      <form className="admin-form" onSubmit={save}>{formError && <p className="admin-notice admin-notice-error" role="alert">{formError}</p>}
        <label className="admin-field">名称<input required maxLength={kind === 'tags' ? 20 : 50} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="admin-field">Slug<input required maxLength={kind === 'tags' ? 20 : 50} value={form.slug} placeholder="例如：web-development" onChange={e => setForm({ ...form, slug: e.target.value })} /><small>唯一的链接标识，请手动填写。</small></label>
        {kind === 'categories' && <label className="admin-field">描述<textarea maxLength={200} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>}
        <div className="admin-dialog-footer"><button type="button" disabled={busy} className="admin-btn admin-btn-secondary" onClick={() => setDialog(false)}>取消</button><button disabled={busy} className="admin-btn admin-btn-primary">{busy ? '保存中…' : '保存'}</button></div>
      </form>
    </AdminDialog>
    <AdminDialog open={!!deleting} onClose={() => setDeleting(null)} title={`删除${label}`} description={`确定删除「${deleting?.name || ''}」？当前关联 ${deleting?.postCount ?? 0} 篇文章。${kind === 'categories' ? '如仍有关联文章，请先将文章移至其他分类后再删除。' : '删除后将无法再选择此标签；文章本身不会删除。'}`} busy={busy}>{formError && <p className="admin-notice admin-notice-error" role="alert">{formError}</p>}<div className="admin-dialog-footer"><button disabled={busy} className="admin-btn admin-btn-secondary" onClick={() => setDeleting(null)}>取消</button><button disabled={busy} className="admin-btn admin-btn-danger" onClick={remove}>{busy ? '删除中…' : '确认删除'}</button></div></AdminDialog>
  </div>
}
