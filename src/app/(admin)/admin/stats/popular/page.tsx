'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../_components'
import { AdminPageHeader, AdminPanel, AdminState } from '@/components/admin/ui'
import { PeriodSelector, type PopularPost } from '@/components/admin/StatsChart'
import { useAdminQuery } from '@/components/admin/use-admin-query'

export default function StatsPopularPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const query = useAdminQuery<{ items: PopularPost[] }>('/stats/popular', { period }, isAuthenticated && !authLoading)
  return <><AdminPageHeader title="热门文章" description="了解哪些内容正在被阅读、被喜欢、被讨论。" actions={<PeriodSelector value={period} onChange={setPeriod} all />} /><AdminPanel title="内容排行榜" description="按所选周期的阅读量降序，最多展示 20 篇；点赞与评论为累计数量。">{query.loading ? <AdminState kind="loading" /> : query.error ? <AdminState kind="error" description={query.error} onRetry={query.retry} /> : !query.data?.items.length ? <AdminState title="本周期暂无阅读记录" description="试试更长的统计周期。" /> : <div className="admin-table-wrap"><table className="admin-table admin-table-mobile"><thead><tr><th>排名</th><th>文章</th><th>阅读量</th><th>累计点赞</th><th>累计评论</th><th>操作</th></tr></thead><tbody>{query.data.items.map((post, index) => <tr key={post.id}><td data-label="排名" className="text-text-muted">{String(index + 1).padStart(2, '0')}</td><td><Link className="admin-cell-title hover:text-primary" href={`/post/${post.id}`}>{post.title}</Link><p className="admin-cell-description">{post.category?.name || '未分类'}</p></td><td data-label="阅读量">{post.periodViews.toLocaleString()}</td><td data-label="累计点赞">{post.likeCount.toLocaleString()}</td><td data-label="累计评论">{post.commentCount.toLocaleString()}</td><td><Link className="text-primary text-xs" href={`/post/${post.id}`}>查看文章 ↗</Link></td></tr>)}</tbody></table></div>}</AdminPanel></>
}
