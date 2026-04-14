/**
 * Archive - 创作记录页面
 */

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Calendar, Activity, Clock, FileText, Edit, Trash2 } from 'lucide-react'
import { format, subDays, startOfYear, endOfYear, eachDayOfInterval, isSameYear } from 'date-fns'
import { cn } from '@/lib/utils'
import { api } from '@/client/api'
import type { AuditLog } from '@/shared/types'

const today = new Date()

export default function Archive() {
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [timelineData, setTimelineData] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // Fetch audit logs for the selected year
      const startDate = format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd')
      const endDate = format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd')

      const result = await api.get('/audit-logs', {
        page: 1,
        pageSize: 100,
        startDate,
        endDate,
      }) as unknown as { code: number; data: { items: AuditLog[]; total: number }; message: string }

      if (result.code === 2000 && result.data) {
        const logs = result.data.items || []

        // Process heatmap data - count posts per day
        const dayCount: Record<string, number> = {}
        logs.forEach((log) => {
          if (log.action.includes('POST')) {
            const date = format(new Date(log.createdAt), 'yyyy-MM-dd')
            dayCount[date] = (dayCount[date] || 0) + 1
          }
        })

        // Generate heatmap data for the year
        const yearStart = startOfYear(new Date(selectedYear, 0, 1))
        const yearEnd = endOfYear(new Date(selectedYear, 0, 1))
        const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd })

        const heatmap = daysInYear.map((day) => ({
          date: format(day, 'yyyy-MM-dd'),
          count: dayCount[format(day, 'yyyy-MM-dd')] || 0,
        }))

        setHeatmapData(heatmap)
        setTimelineData(logs.slice(0, 20)) // Show recent 20 activities
      }
    } catch (error) {
      console.error('Failed to fetch archive data:', error)
      // Generate empty heatmap data
      const yearStart = startOfYear(new Date(selectedYear, 0, 1))
      const yearEnd = endOfYear(new Date(selectedYear, 0, 1))
      const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd })
      setHeatmapData(daysInYear.map((day) => ({ date: format(day, 'yyyy-MM-dd'), count: 0 })))
    } finally {
      setIsLoading(false)
    }
  }

  const getActivityIcon = (action: string) => {
    if (action.includes('CREATE') || action.includes('POST')) return FileText
    if (action.includes('UPDATE') || action.includes('EDIT')) return Edit
    if (action.includes('DELETE')) return Trash2
    return FileText
  }

  const getActivityColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('POST')) return 'text-green-500'
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-500'
    if (action.includes('DELETE')) return 'text-red-500'
    return 'text-gray-500'
  }

  const getActivityLabel = (action: string) => {
    if (action.includes('CREATE') || action.includes('POST')) return '发布'
    if (action.includes('UPDATE') || action.includes('EDIT')) return '编辑'
    if (action.includes('DELETE')) return '删除'
    if (action.includes('LOGIN')) return '登录'
    return action
  }

  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto p-8 max-w-7xl space-y-8"
    >
      <div className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Activity size={24} />
            创作记录
          </div>
          <h1 className="text-3xl font-bold text-text-main">灵感热力图</h1>
          <p className="text-sm text-text-muted">
            记录每一次思考与沉淀。按天统计发布、编辑及删除次数。
          </p>
        </header>

        {/* Heatmap Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-bold text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#ebedf0] dark:bg-[#161b22] rounded-sm"></span>
                Less
              </span>
              <div className="flex gap-1">
                <span className="w-3 h-3 bg-primary/30 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary/50 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary/70 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary rounded-sm"></span>
              </div>
              <span className="flex items-center gap-1">More</span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-sidebar-active/20 dark:bg-sidebar-active/10 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              {[2026, 2025, 2024, 2023].map((year) => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
          </div>

          {/* Simple Heatmap Grid */}
          {isLoading ? (
            <div className="h-24 bg-sidebar rounded-lg animate-pulse" />
          ) : (
            <div className="overflow-x-auto pb-4 relative">
              {/* Tooltip */}
              {hoveredCell && (
                <div
                  className="absolute z-50 px-3 py-2 text-xs bg-popover border border-border rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
                  style={{
                    left: hoveredCell.x,
                    top: hoveredCell.y,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="font-bold text-foreground">{hoveredCell.date}</div>
                  <div className="text-muted-foreground">
                    {hoveredCell.count > 0 ? (
                      <>发布 <span className="text-primary font-bold">{hoveredCell.count}</span> 篇文章</>
                    ) : (
                      '暂无发布'
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-1 min-w-[800px]">
                {/* Weekday labels */}
                <div className="flex flex-col gap-[2px] pr-2 text-[10px] text-text-muted justify-around">
                  <span className="h-3 flex items-center">周日</span>
                  <span className="h-3 flex items-center">周二</span>
                  <span className="h-3 flex items-center">周四</span>
                  <span className="h-3 flex items-center">周六</span>
                </div>
                {/* Heatmap grid with month labels */}
                <div className="flex flex-col">
                  {/* Month labels row */}
                  <div className="flex gap-[2px] mb-1 text-[10px] text-text-muted font-medium">
                    {(() => {
                      const yearStart = startOfYear(new Date(selectedYear, 0, 1))
                      const yearEnd = endOfYear(new Date(selectedYear, 0, 1))
                      const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd })
                      const firstDayOfWeek = yearStart.getDay()
                      const totalWeeks = Math.ceil((daysInYear.length + firstDayOfWeek) / 7)
                      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

                      // Create array of month labels for each week
                      const weekLabels: (string | null)[] = new Array(totalWeeks).fill(null)
                      let currentMonth = -1

                      daysInYear.forEach((day, index) => {
                        const dayIndex = index + firstDayOfWeek
                        const weekIndex = Math.floor(dayIndex / 7)
                        const month = day.getMonth()

                        if (month !== currentMonth) {
                          currentMonth = month
                          weekLabels[weekIndex] = monthNames[month]
                        }
                      })

                      return weekLabels.map((label, i) => (
                        <span key={i} className="w-3 flex items-center">
                          {label}
                        </span>
                      ))
                    })()}
                  </div>

                  {/* Heatmap cells */}
                  <div className="flex gap-[2px]">
                    {(() => {
                      const yearStart = startOfYear(new Date(selectedYear, 0, 1))
                      const yearEnd = endOfYear(new Date(selectedYear, 0, 1))
                      const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd })

                      // Create a map for quick lookup
                      const countMap: Record<string, number> = {}
                      heatmapData.forEach(d => {
                        countMap[d.date] = d.count
                      })

                      // Group days by week (starting from Sunday)
                      const weeks: Date[][] = []
                      let currentWeek: Date[] = []

                      // Pad the first week with null if year doesn't start on Sunday
                      const firstDayOfWeek = yearStart.getDay()
                      for (let i = 0; i < firstDayOfWeek; i++) {
                        currentWeek.push(new Date(0)) // placeholder
                      }

                      daysInYear.forEach((day) => {
                        currentWeek.push(day)
                        if (day.getDay() === 6) {
                          weeks.push(currentWeek)
                          currentWeek = []
                        }
                      })

                      // Push the last week if not empty
                      if (currentWeek.length > 0) {
                        weeks.push(currentWeek)
                      }

                      return weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-[2px]">
                          {week.map((day, dayIndex) => {
                            if (day.getTime() === 0) {
                              // Empty cell for padding
                              return <div key={dayIndex} className="w-3 h-3" />
                            }
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const count = countMap[dateStr] || 0
                            const dayName = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日`
                            // Calculate intensity: each article adds one level of darkness
                            const getIntensityClass = (c: number) => {
                              if (c === 0) return 'bg-[#ebedf0] dark:bg-[#161b22]'
                              if (c === 1) return 'bg-primary/40'
                              if (c === 2) return 'bg-primary/55'
                              if (c === 3) return 'bg-primary/70'
                              if (c === 4) return 'bg-primary/80'
                              if (c === 5) return 'bg-primary/90'
                              if (c >= 6) return 'bg-primary'
                              return 'bg-[#ebedf0] dark:bg-[#161b22]'
                            }
                            return (
                              <div
                                key={dayIndex}
                                className={cn(
                                  'w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-primary/50 hover:scale-125 cursor-pointer relative',
                                  getIntensityClass(count)
                                )}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
                                  setHoveredCell({
                                    date: dayName,
                                    count,
                                    x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                                    y: rect.top - (parentRect?.top || 0) - 8,
                                  })
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
                              />
                            )
                          })}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <div className="space-y-6 pt-8 border-t border-border">
          <div className="flex items-center gap-2 text-lg font-bold text-text-main">
            <Clock size={20} className="text-primary" />
            最近动态
          </div>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {isLoading ? (
              <div className="text-center py-8 text-text-muted">加载中...</div>
            ) : timelineData.length === 0 ? (
              <div className="text-center py-8 text-text-muted">暂无动态</div>
            ) : (
              timelineData.map((item) => {
                const Icon = getActivityIcon(item.action)
                const color = getActivityColor(item.action)
                return (
                  <div
                    key={item.id}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                  >
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-all group-hover:border-primary group-hover:scale-110">
                      <Icon size={18} className={color} />
                    </div>
                    {/* Content */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm group-hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <time className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                        </time>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full bg-sidebar-active/20 dark:bg-sidebar-active/10',
                            color
                          )}
                        >
                          {getActivityLabel(item.action)}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                        {item.target || '未知'}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
