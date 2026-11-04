'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { CommentWithReplies } from '@/shared/types'
import { AdminBadge, AdminDialog, AdminPageHeader, AdminPagination, AdminPanel, AdminSearch, AdminState } from '@/components/admin/ui'
interface AdminComment extends CommentWithReplies { email?: string; post?: { id: string; title: string; slug: string }; ip?: string }
const labels = { all: '全部评论', PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }
type Action = 'approve' | 'reject' | 'delete'
export default function CommentsPage() {
  const { isAuthenticated, isLoading: authLoading, can } = useAuth()
  const [comments, setComments] = useState<AdminComment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<keyof typeof labels>('all')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const requestId = useRef(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true); setLoadError('')
    try {
      const result = await api.get('/comments/admin', { page, pageSize: 20, ...(filter !== 'all' ? { status: filter } : {}) })
      if (request !== requestId.current) return
      if (result.code !== 2000 || !result.data) throw new Error(result.message || '获取评论失败')
      const data = result.data as { items: AdminComment[]; total: number; totalPages: number }
      if (page > Math.max(1, data.totalPages)) { setPage(Math.max(1, data.totalPages)); return }
      setComments(data.items); setTotal(data.total); setPages(Math.max(1, data.totalPages))
      setSelected(prev => new Set(Array.from(prev).filter(id => data.items.some(c => c.id === id))))
    } catch (e) { if (request === requestId.current) setLoadError(e instanceof Error ? e.message : '加载失败，请重试') } finally { if (request === requestId.current) setLoading(false) }
  }, [page, filter])
  useEffect(() => { const sequence = requestId; if (!authLoading && isAuthenticated) void load(); return () => { sequence.current++ } }, [authLoading, isAuthenticated, load])
  const filtered = comments.filter(c => `${c.content} ${c.nickname} ${c.email || ''} ${c.post?.title || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const current = page
  const visible = filtered
  const allSelected = visible.length > 0 && visible.every(c => selected.has(c.id))
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = !allSelected && visible.some(c => selected.has(c.id)) }, [allSelected, visible, selected])
  function toggle(id: string) { setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  async function act(ids: string[], action: Action) {
    if (busy || !ids.length || !can(action === 'delete' ? 'comment:delete' : action === 'approve' ? 'comment:approve' : 'comment:reject')) return
    setBusy(true); setActionError(''); setSuccess('')
    const results = await Promise.allSettled(ids.map(async id => {
      const result = action === 'delete' ? await api.delete(`/comments/${id}`) : await api.put(`/comments/${id}/moderate`, { action })
      if (result.code !== 2000) throw new Error(result.message || '操作失败')
      return id
    }))
    const failed = ids.filter((_, index) => results[index].status === 'rejected')
    const done = ids.filter((_, index) => results[index].status === 'fulfilled')
    setSelected(prev => new Set(Array.from(prev).filter(id => !done.includes(id))))
    if (failed.length) {
      const first = results.find(r => r.status === 'rejected') as PromiseRejectedResult
      setActionError(`${done.length ? `已完成 ${done.length} 条；` : ''}${failed.length} 条操作失败：${first.reason instanceof Error ? first.reason.message : '请重试'}。失败项保留选择。`)
      setSelected(prev => new Set([...Array.from(prev), ...failed]))
    } else setSuccess(`已${action === 'delete' ? '删除' : action === 'approve' ? '通过' : '拒绝'} ${done.length} 条评论。`)
    setDeleting([]); setBusy(false); void load()
  }
  const selectable = can('comment:approve') || can('comment:reject') || can('comment:delete')
  return <div className="space-y-6"><AdminPageHeader title="评论管理" description="倾听读者的声音，让讨论保持友善。" />
    {actionError && <p role="alert" className="admin-notice admin-notice-error">{actionError}</p>}{success && <p role="status" className="admin-notice">{success}</p>}
    <AdminPanel><div className="admin-tabs" role="tablist" aria-label="评论状态">{Object.entries(labels).map(([key, label]) => <button role="tab" key={key} aria-selected={filter === key} disabled={busy} onClick={() => { setFilter(key as keyof typeof labels); setPage(1); setSelected(new Set()) }}>{label}</button>)}</div>
      <div className="admin-toolbar"><AdminSearch value={search} onChange={v => { setSearch(v); setSelected(new Set()) }} placeholder="搜索本页评论、用户或文章…" />{selected.size > 0 && <div className="admin-row-actions"><span>已选 {selected.size} 条</span>{can('comment:approve') && <button disabled={busy} className="admin-btn admin-btn-primary" onClick={() => act(Array.from(selected), 'approve')}>批量通过</button>}{can('comment:reject') && <button disabled={busy} className="admin-btn admin-btn-secondary" onClick={() => act(Array.from(selected), 'reject')}>批量拒绝</button>}{can('comment:delete') && <button disabled={busy} className="admin-btn admin-btn-danger" onClick={() => setDeleting(Array.from(selected))}>批量删除</button>}</div>}</div>
      {authLoading || loading ? <AdminState kind="loading" /> : loadError ? <AdminState kind="error" description={loadError} onRetry={load} /> : !filtered.length ? <AdminState kind="empty" title="暂无符合条件的评论" description="尝试其他筛选条件，或等待新的读者评论。" /> : <div className="admin-table-wrap"><table className="admin-table admin-table-mobile"><thead><tr>{selectable && <th><input ref={selectAllRef} type="checkbox" aria-label="选择本页全部评论" disabled={busy} checked={allSelected} onChange={() => setSelected(prev => { const next = new Set(prev); visible.forEach(c => allSelected ? next.delete(c.id) : next.add(c.id)); return next })} /></th>}<th>评论内容</th><th>用户</th><th>关联文章</th><th>状态</th><th>时间 / IP</th><th>操作</th></tr></thead><tbody>{visible.map(c => <tr key={c.id}>{selectable && <td data-label="选择"><input type="checkbox" aria-label={`选择 ${c.nickname} 的评论`} disabled={busy} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>}<td data-label="评论内容"><p style={{ maxWidth: 340, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.content}</p></td><td data-label="用户"><strong>{c.nickname}</strong><p className="text-xs text-muted-foreground">{c.email}</p></td><td data-label="关联文章">{c.post ? can('post:update') ? <Link href={`/admin/posts/${c.post.id}`}>{c.post.title}</Link> : c.post.title : '—'}</td><td data-label="状态"><AdminBadge tone={c.status === 'APPROVED' ? 'success' : c.status === 'PENDING' ? 'warning' : 'danger'}>{labels[c.status as keyof typeof labels] || c.status}</AdminBadge></td><td data-label="时间 / IP">{new Date(c.createdAt).toLocaleDateString('zh-CN')}<p className="text-xs text-muted-foreground">{c.ip?.includes('.') ? c.ip.split('.').slice(0, 2).join('.') + '.*.*' : c.ip ? c.ip.split(':').slice(0, 2).join(':') + ':*' : '—'}</p></td><td data-label="操作"><div className="admin-row-actions">{c.status !== 'APPROVED' && can('comment:approve') && <button disabled={busy} className="admin-btn admin-btn-ghost" onClick={() => act([c.id], 'approve')}>通过</button>}{c.status !== 'REJECTED' && can('comment:reject') && <button disabled={busy} className="admin-btn admin-btn-ghost" onClick={() => act([c.id], 'reject')}>拒绝</button>}{can('comment:delete') && <button disabled={busy} className="admin-btn admin-btn-danger" onClick={() => setDeleting([c.id])}>删除</button>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !loadError && <AdminPagination page={current} totalPages={pages} total={total} disabled={busy} onPageChange={p => { setPage(p); setSelected(new Set()) }} />}
    </AdminPanel><AdminDialog open={deleting.length > 0} onClose={() => setDeleting([])} title="删除评论" description={`确定删除选中的 ${deleting.length} 条评论？此操作不可撤销。`} busy={busy}><div className="admin-dialog-footer"><button disabled={busy} className="admin-btn admin-btn-secondary" onClick={() => setDeleting([])}>取消</button><button disabled={busy} className="admin-btn admin-btn-danger" onClick={() => act(deleting, 'delete')}>{busy ? '删除中…' : '确认删除'}</button></div></AdminDialog>
  </div>
}
