'use client'

import { useState } from 'react'
import { useAuth } from '../../../_components'
import { AdminPageHeader, AdminPanel, AdminState } from '@/components/admin/ui'
import { StatsChart, PeriodSelector, type ViewStatistics } from '@/components/admin/StatsChart'
import { useAdminQuery } from '@/components/admin/use-admin-query'

export default function StatsViewsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const query = useAdminQuery<ViewStatistics>('/stats/views', { period }, isAuthenticated && !authLoading)
  const overview = query.data?.overview
  return <div className="space-y-6"><AdminPageHeader title="阅读统计" description="看见阅读的变化，找到持续表达的方向。" actions={<PeriodSelector value={period} onChange={p => { if (p !== 'all') setPeriod(p) }} />} />{query.loading ? <AdminState kind="loading" /> : query.error ? <AdminState kind="error" description={query.error} onRetry={query.retry} /> : overview && <><div className="admin-stat-grid">{[
    ['累计阅读', overview.totalViews.toLocaleString(), '已发布文章累计'], ['今日阅读', overview.todayViews.toLocaleString(), '截至当前 · 北京时间'], ['日均阅读', overview.avgViews.toLocaleString(), `近 ${parseInt(period)} 天`], ['阅读增长', overview.growth === null ? '—' : `${overview.growth > 0 ? '+' : ''}${overview.growth}%`, overview.growth === null ? '上一周期无阅读记录' : '较上一同长周期'],
  ].map(([label, value, note]) => <div key={label} className="admin-stat"><p className="admin-stat-label">{label}</p><p className="admin-stat-value">{value}</p><p className="admin-stat-note">{note}</p></div>)}</div><AdminPanel title="阅读趋势" description={`${query.data?.views[0]?.date} — ${query.data?.views.at(-1)?.date} · 每日阅读次数`}><StatsChart data={query.data?.views ?? []} variant="bar" /></AdminPanel><p className="admin-notice">趋势按北京时间统计阅读记录。累计阅读保留文章累计计数；历史记录不足时，不推算缺失数据。</p></>}</div>
}
