/**
 * Header - 顶部导航组件
 */

'use client'

import Link from 'next/link'
import { Search, Moon, Sun, User, Cloud, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  isSidebarVisible?: boolean
  onToggleSidebar?: () => void
}

export function Header({ isSidebarVisible = true, onToggleSidebar }: HeaderProps) {
  return (
    <header className="w-full bg-background border-b border-border">
      <div className="px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo & Toggle */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded hover:bg-sidebar-active/50 text-text-muted hover:text-primary transition-colors"
              title={isSidebarVisible ? '隐藏侧边栏' : '显示侧边栏'}
            >
              {isSidebarVisible ? (
                <PanelLeftClose size={20} />
              ) : (
                <PanelLeftOpen size={20} />
              )}
            </button>
          )}
          <Link href="/" className="flex items-center gap-2">
            <Cloud className="text-primary" size={20} />
            <h1 className="text-sm font-bold text-text-main hidden sm:block">
              Frytea's Blog
            </h1>
          </Link>
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
          <button className="p-2 rounded-full hover:bg-sidebar-active/50 transition-colors text-text-muted hover:text-primary">
            <Moon size={20} />
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
  )
}
