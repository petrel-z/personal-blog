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
  onToggle?: () => void
}

export function TableOfContents({ onToggle }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Mock TOC items
  const tocItems: TOCItem[] = [
    { id: 'intro', text: '为什么需要这个工具？', level: 2 },
    { id: 'features', text: '核心功能', level: 3 },
    { id: 'summary', text: '总结', level: 2 },
  ]

  return (
    <div className="space-y-4">
      <nav className="p-4">
        <ul className="space-y-1">
          {tocItems.map((item) => (
            <li
              key={item.id}
              style={{ paddingLeft: `${(item.level - 2) * 1}rem` }}
            >
              <a
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
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
      </nav>
    </div>
  )
}
