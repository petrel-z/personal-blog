/**
 * PublicLayout - 公开页面布局
 * 基础布局：Header + 左侧 Sidebar + 页面内容
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cloud, Search, Moon, Sun, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Sidebar } from './_components/Sidebar'
import { cn } from '@/lib/utils'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="h-screen flex flex-col bg-background text-text-main overflow-hidden">
      {/* Header - Sticky */}
      <header className="w-full bg-background border-b border-border">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Toggle */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="p-2 rounded hover:bg-sidebar-active/50 text-text-muted hover:text-primary transition-colors"
              title={isSidebarVisible ? '隐藏侧边栏' : '显示侧边栏'}
            >
              {isSidebarVisible ? (
                <PanelLeftClose size={20} />
              ) : (
                <PanelLeftOpen size={20} />
              )}
            </button>
            <div className="flex items-center gap-2">
              <Cloud className="text-primary" size={20} />
              <h1 className="text-sm font-bold text-text-main hidden sm:block">
                Petrel's Blog
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-text-muted group-focus-within:text-primary transition-colors">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="搜索 (Ctrl + K)"
              className="w-full bg-sidebar border border-border rounded py-1.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-sidebar-active/50 transition-colors text-text-muted hover:text-primary"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-sidebar-active/50 transition-colors border border-border group">
              <span className="text-xs font-medium text-text-muted group-hover:text-primary transition-colors hidden md:block">
                博主
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
                <User size={20} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Collapsible */}
        <aside
          className={cn(
            'border-r border-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden h-full',
            isSidebarVisible ? 'w-64' : 'w-0'
          )}
        >
          <div className={cn('h-full', !isSidebarVisible && 'hidden')}>
            <Sidebar />
          </div>
        </aside>

        {/* Page Content */}
        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
