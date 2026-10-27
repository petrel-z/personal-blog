'use client'

import { useId } from 'react'
import { AdminState } from './ui'
import './stats.css'

export interface ViewPoint { date: string; views: number }
export interface ViewStatistics { views: ViewPoint[]; overview: { totalViews: number; todayViews: number; periodViews: number; avgViews: number; growth: number | null } }
export interface PopularPost { id: string; title: string; slug: string; viewCount: number; periodViews: number; likeCount: number; commentCount: number; publishedAt: string | null; category?: { name: string } | null }

export function StatsChart({ data, variant = 'line' }: { data: ViewPoint[]; variant?: 'line' | 'bar' }) {
  const id = useId()
  if (!data.length) return <AdminState title="暂无阅读记录" description="文章被阅读后，趋势将在这里呈现。" />
  const max = Math.max(4, ...data.map(point => point.views))
  const ceiling = Math.ceil(max / 4) * 4
  const width = 740, height = 200, left = 50, top = 18
  const point = (i: number) => ({ x: left + (i / Math.max(data.length - 1, 1)) * width, y: top + height - data[i].views / ceiling * height })
  const points = data.map((_, i) => point(i))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const labelIndexes = Array.from(new Set([0, Math.floor((data.length - 1) / 4), Math.floor((data.length - 1) / 2), Math.floor((data.length - 1) * 3 / 4), data.length - 1]))
  return <div className="admin-chart"><svg viewBox="0 0 815 260" role="img" aria-labelledby={id}><title id={id}>{data[0].date} 至 {data.at(-1)?.date} 的每日阅读量，总计 {data.reduce((sum, p) => sum + p.views, 0)} 次</title>{[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} y1={top + i * height / 4} x2={left + width} y2={top + i * height / 4} stroke="#e9ede7" /><text x={left - 12} y={top + i * height / 4 + 4} textAnchor="end" fill="#7a848c" fontSize="10">{(ceiling * (4 - i) / 4).toLocaleString()}</text></g>)}{variant === 'line' ? <><path d={`${line} L${left + width},${top + height} L${left},${top + height} Z`} fill="#f0f3fc" /><path d={line} fill="none" stroke="#4167d5" strokeWidth="2.5" strokeLinejoin="round" />{points.map((p, i) => <circle key={data[i].date} cx={p.x} cy={p.y} r={data.length < 32 ? 3 : 1.5} fill="#4167d5"><title>{data[i].date}：{data[i].views.toLocaleString()} 次阅读</title></circle>)}</> : data.map((p, i) => { const barWidth = width / data.length; return <rect key={p.date} x={left + i * barWidth + 2} y={top + height - p.views / ceiling * height} width={Math.max(1, barWidth - 4)} height={Math.max(0, p.views / ceiling * height)} rx="2" fill={i === data.length - 1 ? '#4167d5' : '#c7d4f3'}><title>{p.date}：{p.views.toLocaleString()} 次阅读</title></rect> })}{labelIndexes.map(i => <text key={i} x={point(i).x} y="246" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fill="#7a848c" fontSize="10">{data[i].date.slice(5).replace('-', '.')}</text>)}</svg><details className="admin-chart-data"><summary>查看每日数据</summary><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>日期（北京时间）</th><th>阅读量</th></tr></thead><tbody>{data.map(p => <tr key={p.date}><td>{p.date}</td><td>{p.views.toLocaleString()}</td></tr>)}</tbody></table></div></details></div>
}

export function PeriodSelector({ value, onChange, all = false }: { value: string; onChange: (value: '7d' | '30d' | '90d' | 'all') => void; all?: boolean }) {
  return <div className="admin-period" role="group" aria-label="统计周期">{(all ? ['7d', '30d', '90d', 'all'] : ['7d', '30d', '90d']).map(p => <button key={p} type="button" aria-pressed={value === p} onClick={() => onChange(p as '7d' | '30d' | '90d' | 'all')}>{p === 'all' ? '全部' : `${parseInt(p)} 天`}</button>)}</div>
}
