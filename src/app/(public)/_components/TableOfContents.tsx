/**
 * TableOfContents - 文章目录组件
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  items: TOCItem[]
  onToggle?: () => void
  onScrollTo?: (id: string) => void
}

export function TableOfContents({ items, onToggle, onScrollTo }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setActiveId(id)

    // 通知父组件滚动，由父组件控制滚动容器
    if (onScrollTo) {
      onScrollTo(id)
    }
  }

  return (
    <div className="space-y-4">
      <nav className="p-4">
        {items.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">暂无目录</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.id}
                style={{ paddingLeft: `${(item.level - 2) * 1}rem` }}
              >
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={cn(
                    'block py-1.5 text-xs transition-all border-l-2 pl-3',
                    activeId === item.id
                      ? 'text-primary border-primary font-bold bg-primary/5'
                      : 'text-text-muted border-transparent hover:text-text-main hover:bg-sidebar-active/30 hover:border-sidebar-active'
                  )}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  )
}
