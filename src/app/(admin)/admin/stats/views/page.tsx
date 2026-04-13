'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '../../../_components'

interface ViewStats {
  date: string
  views: number
}

interface OverviewStats {
  totalViews: number
  todayViews: number
  avgViews: number
  growth: number
}

export default function StatsViewsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [stats, setStats] = useState<ViewStats[]>([])
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchStats()
  }, [isAuthenticated, authLoading, period])

  const fetchStats = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/stats/views', { period }) as { code: number; data: { views: ViewStats[]; overview: OverviewStats }; message: string }
      if (result.code === 2000 && result.data) {
        setStats(result.data.views || [])
        setOverview(result.data.overview || null)
      }
    } catch {
      console.error('Failed to fetch stats')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">阅读统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            追踪文章的阅读量趋势
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1 p-1 bg-sidebar rounded-lg">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? 'bg-background shadow-sm font-medium'
                  : 'hover:bg-background/50'
              }`}
            >
              {p === '7d' ? '7天' : p === '30d' ? '30天' : '90天'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">总阅读量</p>
            <p className="text-2xl font-bold mt-1">
              {overview.totalViews.toLocaleString()}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">今日阅读</p>
            <p className="text-2xl font-bold mt-1">
              {overview.todayViews.toLocaleString()}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">日均阅读</p>
            <p className="text-2xl font-bold mt-1">
              {overview.avgViews.toLocaleString()}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">增长率</p>
            <p className={`text-2xl font-bold mt-1 ${
              overview.growth >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {overview.growth >= 0 ? '+' : ''}{overview.growth}%
            </p>
          </div>
        </div>
      )}

      {/* Chart Placeholder */}
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="font-medium mb-4">阅读趋势</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {stats.length === 0 ? '暂无数据' : (
            <div className="w-full">
              {/* Simple bar chart visualization */}
              <div className="flex items-end gap-1 h-48">
                {stats.slice(-14).map((s, i) => {
                  const maxViews = Math.max(...stats.map(x => x.views), 1)
                  const height = (s.views / maxViews) * 100
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 hover:bg-primary/30 transition-colors rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${s.date}: ${s.views}`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{stats[0]?.date}</span>
                <span>{stats[stats.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
