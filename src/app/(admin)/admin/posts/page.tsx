'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { postStatusFilter } from '@/components/admin/content-editor-state'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { PostWithRelations, Category } from '@/shared/types'
import { AdminBadge, AdminDialog, AdminPageHeader, AdminPagination, AdminPanel, AdminSearch, AdminState } from '@/components/admin/ui'
const statuses = { all: '全部文章', PUBLISHED: '已发布', DRAFT: '草稿', ARCHIVED: '已归档' }
export default function PostsPage() {
  const { isAuthenticated, isLoading: authLoading, can } = useAuth()
  const [posts, setPosts] = useState<PostWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<keyof typeof statuses>('all')
  const [filterReady, setFilterReady] = useState(false)
  useEffect(() => { setFilter(postStatusFilter(new URLSearchParams(window.location.search).get('status'))); setFilterReady(true) }, [])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const requestId = useRef(0)
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1) }, 250); return () => clearTimeout(timer) }, [search])
  const [deleting, setDeleting] = useState<PostWithRelations | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const load = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true); setError('')
    try {
      const [result, cs] = await Promise.all([api.get('/posts', { scope: 'admin', page, pageSize: 10, ...(filter !== 'all' ? { status: filter } : {}), ...(category ? { categoryId: category } : {}), ...(query.trim() ? { search: query.trim() } : {}) }), api.get('/categories')])
      if (request !== requestId.current) return
      if (result.code !== 2000 || !result.data) throw new Error(result.message || '获取文章失败')
      if (cs.code !== 2000 || !Array.isArray(cs.data)) throw new Error(cs.message || '获取分类失败')
      const data = result.data as { items: PostWithRelations[]; total: number; totalPages: number }
      if (page > Math.max(1, data.totalPages)) { setPage(Math.max(1, data.totalPages)); return }
      setPosts(data.items); setTotal(data.total); setPages(Math.max(1, data.totalPages)); setCategories(cs.data as Category[])
    } catch (e) { if (request === requestId.current) setError(e instanceof Error ? e.message : '加载失败，请重试') } finally { if (request === requestId.current) setLoading(false) }
  }, [page, filter, category, query])
  useEffect(() => { const sequence = requestId; if (!authLoading && isAuthenticated && filterReady) void load(); return () => { sequence.current++ } }, [authLoading, isAuthenticated, filterReady, load])
  const filtered = posts
  const current = page
  async function remove() {
    if (!deleting || busy || !can('post:delete')) return
    setBusy(true); setDeleteError('')
    try {
      const result = await api.delete(`/posts/${deleting.id}`)
      if (result.code !== 2000) throw new Error(result.message || '删除文章失败')
      setDeleting(null); void load()
    } catch (e) { setDeleteError(e instanceof Error ? e.message : '删除失败，请重试') } finally { setBusy(false) }
  }
  return <div className="space-y-6"><AdminPageHeader title="文章管理" description="记录想法，整理知识，持续创作。" actions={can('post:create') && <Link href="/admin/posts/new" className="admin-btn admin-btn-primary">＋ 写文章</Link>} />
    <AdminPanel><div className="admin-tabs" role="tablist" aria-label="文章状态">{Object.entries(statuses).map(([key, label]) => <button role="tab" key={key} aria-selected={filter === key} onClick={() => { setFilter(key as keyof typeof statuses); setPage(1) }}>{label}</button>)}</div>
      <div className="admin-toolbar"><AdminSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="搜索文章标题…" /><label className="admin-field"><span className="sr-only">筛选分类</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}><option value="">全部分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      {authLoading || loading ? <AdminState kind="loading" /> : error ? <AdminState kind="error" description={error} onRetry={load} /> : !filtered.length ? <AdminState kind="empty" title="暂无符合条件的文章" description="尝试调整筛选条件，或开始写一篇文章。" /> : <div className="admin-table-wrap"><table className="admin-table admin-table-mobile"><thead><tr><th>文章标题</th><th>分类</th><th>状态</th><th>阅读 / 评论</th><th>发布时间</th><th>操作</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td data-label="文章标题">{can('post:update') ? <Link href={`/admin/posts/${p.id}`}><strong>{p.title}</strong></Link> : <strong>{p.title}</strong>}<div className="text-xs text-muted-foreground mt-2">{p.tags.map(t => `#${t.name}`).join('　')}</div></td><td data-label="分类">{p.category?.name || '未分类'}</td><td data-label="状态"><AdminBadge tone={p.status === 'PUBLISHED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'neutral'}>{statuses[p.status as keyof typeof statuses] || p.status}</AdminBadge></td><td data-label="阅读 / 评论">{p.viewCount.toLocaleString()} / {p.commentCount.toLocaleString()}</td><td data-label="发布时间">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('zh-CN') : '—'}</td><td data-label="操作"><div className="admin-row-actions">{can('post:update') && <Link className="admin-btn admin-btn-ghost" href={`/admin/posts/${p.id}`}>编辑</Link>}{can('post:delete') && <button className="admin-btn admin-btn-danger" onClick={() => { setDeleting(p); setDeleteError('') }}>删除</button>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !error && <AdminPagination page={current} totalPages={pages} total={total} onPageChange={setPage} />}
    </AdminPanel><AdminDialog open={!!deleting} onClose={() => setDeleting(null)} title="删除文章" description={`确定删除「${deleting?.title || ''}」？文章将从列表中移除。`} busy={busy}>{deleteError && <p className="admin-notice admin-notice-error" role="alert">{deleteError}</p>}<div className="admin-dialog-footer"><button disabled={busy} className="admin-btn admin-btn-secondary" onClick={() => setDeleting(null)}>取消</button><button disabled={busy} className="admin-btn admin-btn-danger" onClick={remove}>{busy ? '删除中…' : '确认删除'}</button></div></AdminDialog></div>
}
