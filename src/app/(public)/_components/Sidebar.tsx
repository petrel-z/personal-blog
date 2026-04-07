/**
 * Sidebar - 左侧边栏导航
 * 包含：导航菜单、分类列表
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Home,
  LayoutGrid,
  User,
  MessageSquare,
  Rss,
  Link as LinkIcon,
  Archive,
  ChevronDown,
} from 'lucide-react'
import { api } from '@/client/api'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '首页', path: '/', icon: Home },
  { label: '作品', path: '/works', icon: LayoutGrid },
  { label: '关于', path: '/about', icon: User },
  { label: '留言', path: '/guestbook', icon: MessageSquare },
  { label: '订阅', path: '/rss', icon: Rss },
  { label: '友链', path: '/links', icon: LinkIcon },
  { label: '归档', path: '/archive', icon: Archive },
]

interface CategoryWithCount {
  id: string
  name: string
  slug: string
  description?: string
  postCount: number
}

export function Sidebar() {
  const pathname = usePathname()
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true)
  const [categories, setCategories] = useState<CategoryWithCount[]>([])

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const result = await api.get('/categories') as unknown as { code: number; data: CategoryWithCount[]; message: string }
      if (result.code === 2000 && result.data) {
        // API returns data as array directly
        setCategories(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  return (
    <aside className="h-full flex flex-col bg-sidebar">
      {/* Top Fixed Section: Navigation + Categories Header */}
      <div className="flex-shrink-0 p-4 pb-2">
        <nav className="p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 rounded transition-colors text-sm font-medium',
                      isActive
                        ? 'bg-sidebar-active text-text-main'
                        : 'text-text-muted hover:bg-sidebar-active/50 hover:text-text-main'
                    )}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Categories Header */}
        <button
          onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
          className="w-full flex items-center justify-between px-6 py-3 mt-2 text-sm font-bold text-text-muted hover:bg-sidebar-active/50 transition-colors border-t border-border/30"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} />
            分类
          </div>
          <ChevronDown
            size={16}
            className={cn('transition-transform', !isCategoriesOpen && '-rotate-90')}
          />
        </button>
      </div>

      {/* Elastic Scrollable Section: Category List */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 custom-scrollbar">
        {isCategoriesOpen && (
          <ul className="pb-4">
            {categories.length === 0 ? (
              <li className="px-6 py-2 text-sm text-text-muted">暂无分类</li>
            ) : (
              categories.map((cat) => {
                const isActive = pathname === `/category/${cat.slug}`
                return (
                  <li key={cat.id}>
                    <Link
                      href={`/category/${cat.slug}`}
                      className={cn(
                        'flex items-center justify-between px-6 py-2 text-sm transition-colors',
                        isActive
                          ? 'text-text-main bg-sidebar-active'
                          : 'text-text-muted hover:text-text-main hover:bg-sidebar-active/50'
                      )}
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] bg-sidebar-active/40 dark:bg-sidebar-active/20 px-1.5 py-0.5 rounded text-text-muted font-medium">
                        {cat.postCount || 0}
                      </span>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>

      {/* Bottom Fixed Section: Icons */}
      <div className="flex-shrink-0 p-4 border-t border-border/50 bg-sidebar">
        <div className="flex items-center justify-center gap-6 py-2 text-text-muted">
          <button className="hover:text-primary transition-colors">
            <MessageSquare size={18} />
          </button>
          <button className="hover:text-primary transition-colors">
            <Rss size={18} />
          </button>
          <button className="hover:text-primary transition-colors">
            <Archive size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
