'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { LayoutDashboard, FileText, Folder, Tags, MessageSquare, BarChart3, TrendingUp, Users, ShieldCheck, ListFilter, ScrollText, Settings, X } from 'lucide-react'
import { getAdminNavigation } from '@/components/admin/navigation'
import { useAuth } from './AuthProvider'

const icons = { dashboard: LayoutDashboard, posts: FileText, categories: Folder, tags: Tags, comments: MessageSquare, stats: BarChart3, popular: TrendingUp, users: Users, roles: ShieldCheck, words: ListFilter, logs: ScrollText, settings: Settings }

export function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { user, permissions } = useAuth()
  const groups = getAdminNavigation(permissions)
  const content = <>
    <Link href={groups[0]?.items[0]?.href ?? '/'} className="admin-brand" onClick={onClose}><span className="admin-brand-mark">P</span><span><strong>PETREL</strong><small>内容管理空间</small></span></Link>
    <div className="admin-workspace">个人博客</div>
    <nav className="admin-nav" aria-label="后台导航">{groups.map(group => <div className="admin-nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map(item => {
      const Icon = icons[item.icon]
      const active = pathname === item.href || pathname.startsWith(item.href + '/')
      return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? 'page' : undefined}><Icon size={18} strokeWidth={1.5} aria-hidden="true" />{item.label}</Link>
    })}</div>)}</nav>
    <div className="admin-user"><span className="admin-avatar">{(user?.name || user?.email || 'P').slice(0, 1).toUpperCase()}</span><div className="admin-user-name"><strong>{user?.name || '我的账号'}</strong><small title={user?.email}>{user?.email}</small></div></div>
  </>
  return <>
    <aside className="admin-sidebar admin-sidebar-desktop">{content}</aside>
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}><Dialog.Portal><Dialog.Overlay className="admin-theme admin-dialog-overlay lg:hidden" /><Dialog.Content className="admin-theme admin-sidebar admin-sidebar-mobile lg:hidden" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('admin-menu-trigger')?.focus() }}><Dialog.Title className="sr-only">后台导航菜单</Dialog.Title><Dialog.Close className="admin-icon-btn absolute right-3 top-3" aria-label="关闭导航"><X size={16} /></Dialog.Close>{content}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </>
}
