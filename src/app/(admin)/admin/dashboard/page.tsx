'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useAuth } from '../../_components'
import { AdminPageHeader, AdminPanel, AdminState } from '@/components/admin/ui'
import { StatsChart, PeriodSelector, type ViewStatistics, type PopularPost } from '@/components/admin/StatsChart'
import { useAdminQuery } from '@/components/admin/use-admin-query'

interface Overview { postCount: number; commentCount: number; totalViews: number; totalLikes: number }
interface Comment { id: string; content: string; nickname: string; createdAt: string }
interface PageData<T> { items: T[]; total: number }

export default function DashboardPage() {
  const { user, can, isAuthenticated, isLoading } = useAuth()
  const ready = isAuthenticated && !isLoading
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const overview = useAdminQuery<Overview>('/stats', {}, ready)
  const views = useAdminQuery<ViewStatistics>('/stats/views', { period }, ready)
  const popular = useAdminQuery<{ items: PopularPost[] }>('/stats/popular', { period: 'all' }, ready)
  const comments = useAdminQuery<PageData<Comment>>('/comments/admin', { pageSize: 2 }, ready && can('comment:read'))
  const pending = useAdminQuery<PageData<Comment>>('/comments/admin', { pageSize: 1, status: 'PENDING' }, ready && can('comment:read'))
  const drafts = useAdminQuery<PageData<unknown>>('/posts', { pageSize: 1, status: 'DRAFT', scope: 'admin' }, ready && can('post:read'))
  return <>
    <AdminPageHeader title="每一次记录，都在积累。" description={`欢迎回来，${user?.name || '朋友'}。这里是你的内容近况。`} actions={can('post:create') && <Link href="/admin/posts/new" className="admin-btn admin-btn-primary"><Plus size={16} />撰写文章</Link>} />
    {overview.loading ? <AdminPanel><AdminState kind="loading" title="正在加载内容近况…" /></AdminPanel> : overview.error ? <AdminPanel><AdminState kind="error" description={overview.error} onRetry={overview.retry} /></AdminPanel> : overview.data && <div className="admin-stat-grid">{[
      ['总阅读量', overview.data.totalViews, '已发布文章累计'], ['已发布文章', overview.data.postCount, '持续积累，慢慢生长'], ['收到的评论', overview.data.commentCount, '已通过审核的评论'], ['获得的赞', overview.data.totalLikes, '来自读者的支持'],
    ].map(([label, value, note]) => <div className="admin-stat" key={label}><p className="admin-stat-label">{label}</p><p className="admin-stat-value">{Number(value).toLocaleString()}</p><p className="admin-stat-note">{note}</p></div>)}</div>}
    <div className="admin-dashboard-grid"><AdminPanel title="阅读趋势" description={`近 ${parseInt(period)} 天 · 每日阅读量`} actions={<PeriodSelector value={period} onChange={p => { if (p !== 'all') setPeriod(p) }} />}>{views.loading ? <AdminState kind="loading" /> : views.error ? <AdminState kind="error" description={views.error} onRetry={views.retry} /> : <StatsChart data={views.data?.views ?? []} />}</AdminPanel><AdminPanel title="值得关注" description="留一点时间，回应读者的声音。" className="admin-attention"><div className="admin-attention-list">{can('comment:read') && (pending.error ? <AdminState kind="error" title="待审评论加载失败" onRetry={pending.retry} /> : <Link href="/admin/comments"><strong>{pending.loading ? '—' : String(pending.data?.total ?? 0).padStart(2, '0')}</strong><div><h3>待审核评论</h3><p>查看并处理最新评论</p></div><ArrowUpRight size={20} /></Link>)}{can('post:read') && (drafts.error ? <AdminState kind="error" title="草稿加载失败" onRetry={drafts.retry} /> : <Link href="/admin/posts?status=DRAFT"><strong>{drafts.loading ? '—' : String(drafts.data?.total ?? 0).padStart(2, '0')}</strong><div><h3>未完成草稿</h3><p>继续写下你的想法</p></div><ArrowUpRight size={20} /></Link>)}{!can('comment:read') && !can('post:read') && <p className="py-8 text-sm text-text-muted">当前角色可查看数据，内容管理入口按权限展示。</p>}</div></AdminPanel>
    <AdminPanel title="热门文章" actions={<Link href="/admin/stats/popular" className="text-xs text-text-muted">查看全部 ↗</Link>}>{popular.loading ? <AdminState kind="loading" /> : popular.error ? <AdminState kind="error" description={popular.error} onRetry={popular.retry} /> : !popular.data?.items.length ? <AdminState title="还没有热门文章" description="发布内容后，读者的喜爱将在这里留下痕迹。" /> : popular.data.items.slice(0, 3).map((post, i) => <div key={post.id} className="admin-recent-post"><span className="text-text-muted">{String(i + 1).padStart(2, '0')}</span><Link href={`/post/${post.id}`}><h3>{post.title}</h3><small>{post.category?.name || '未分类'}</small></Link><span>{post.viewCount.toLocaleString()} <small className="text-text-muted">阅读</small></span></div>)}</AdminPanel>
    {can('comment:read') && <AdminPanel title="最近评论" actions={<Link href="/admin/comments" className="text-xs text-text-muted">查看全部 ↗</Link>}>{comments.loading ? <AdminState kind="loading" /> : comments.error ? <AdminState kind="error" description={comments.error} onRetry={comments.retry} /> : !comments.data?.items.length ? <AdminState title="还没有评论" description="期待与读者的第一次交流。" /> : comments.data.items.map(comment => <article key={comment.id} className="admin-comment-preview"><div><span className="admin-avatar">{comment.nickname.slice(0, 1)}</span><span className="text-xs font-medium">{comment.nickname}</span><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' })}</time></div><p className="line-clamp-2">{comment.content}</p></article>)}</AdminPanel>}</div>
  </>
}
