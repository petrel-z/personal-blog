/**
 * Archive - 创作记录页面
 */

'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Calendar, Activity, Clock, FileText, Edit, Trash2 } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'

const today = new Date()

const heatmapData = Array.from({ length: 365 }).map((_, i) => ({
  date: format(subDays(today, i), 'yyyy-MM-dd'),
  count: Math.floor(Math.random() * 5),
}))

const timelineData = [
  {
    id: '1',
    type: 'publish',
    title: '快速选出收益最高的理财产品',
    date: '2025-06-15 10:30',
    icon: FileText,
    color: 'text-green-500',
  },
  {
    id: '2',
    type: 'edit',
    title: 'ceph mon Operation not permitted 问题解决',
    date: '2026-04-03 14:20',
    icon: Edit,
    color: 'text-blue-500',
  },
  {
    id: '3',
    type: 'delete',
    title: '测试文章',
    date: '2026-04-02 09:15',
    icon: Trash2,
    color: 'text-red-500',
  },
  {
    id: '4',
    type: 'publish',
    title: 'Ascend 310P + openFuyao + NPU-Operator 故障排查',
    date: '2026-04-01 11:00',
    icon: FileText,
    color: 'text-green-500',
  },
]

export default function Archive() {
  const [selectedYear, setSelectedYear] = useState(2026)

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
                <span className="w-3 h-3 bg-sidebar-active/20 dark:bg-sidebar-active/10 rounded-sm"></span>
                Less
              </span>
              <div className="flex gap-1">
                <span className="w-3 h-3 bg-primary/20 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary/40 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary/60 rounded-sm"></span>
                <span className="w-3 h-3 bg-primary/80 rounded-sm"></span>
              </div>
              <span className="flex items-center gap-1">More</span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-sidebar-active/20 dark:bg-sidebar-active/10 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value={2026}>2026年</option>
              <option value={2025}>2025年</option>
              <option value={2024}>2024年</option>
            </select>
          </div>

          {/* Simple Heatmap Grid */}
          <div className="overflow-x-auto pb-4">
            <div className="grid grid-rows-7 grid-flow-col gap-1 min-w-[800px]">
              {/* Weekday labels */}
              <div className="flex flex-col gap-1 pr-2 text-[10px] text-text-muted justify-around">
                <span>周日</span>
                <span>周二</span>
                <span>周四</span>
                <span>周六</span>
              </div>
              {Array.from({ length: 52 }).map((_, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const index = weekIndex * 7 + dayIndex
                    const data = heatmapData[index]
                    const intensity = data?.count || 0
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          'w-3 h-3 rounded-sm transition-colors hover:ring-2 hover:ring-primary cursor-pointer',
                          intensity === 0 && 'bg-sidebar',
                          intensity === 1 && 'bg-primary/20',
                          intensity === 2 && 'bg-primary/40',
                          intensity === 3 && 'bg-primary/60',
                          intensity >= 4 && 'bg-primary/80'
                        )}
                        title={`${data?.date}: ${data?.count || 0} 次操作`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="space-y-6 pt-8 border-t border-border">
          <div className="flex items-center gap-2 text-lg font-bold text-text-main">
            <Clock size={20} className="text-primary" />
            最近动态
          </div>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {timelineData.map((item) => (
              <div
                key={item.id}
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
              >
                {/* Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-all group-hover:border-primary group-hover:scale-110">
                  <item.icon size={18} className={item.color} />
                </div>
                {/* Content */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm group-hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <time className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {item.date}
                    </time>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full bg-sidebar-active/20 dark:bg-sidebar-active/10',
                        item.color
                      )}
                    >
                      {item.type === 'publish'
                        ? '发布'
                        : item.type === 'edit'
                          ? '编辑'
                          : '删除'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
