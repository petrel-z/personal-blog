'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu } from 'lucide-react'
import { Fragment } from 'react'
import { getAdminBreadcrumbs } from '@/components/admin/navigation'
import { LogoutButton } from './LogoutButton'

export function AdminHeader({ onMenuClick, menuOpen = false }: { onMenuClick: () => void; menuOpen?: boolean }) {
  const crumbs = getAdminBreadcrumbs(usePathname())
  return <header className="admin-topbar"><button id="admin-menu-trigger" className="admin-icon-btn admin-menu-trigger" aria-label="打开导航" aria-expanded={menuOpen} onClick={onMenuClick}><Menu size={18} /></button><nav className="admin-breadcrumbs" aria-label="面包屑"><span className="admin-crumb-root">工作空间</span>{crumbs.map((crumb, index) => <Fragment key={crumb.label}><span className="admin-crumb-separator text-text-muted" aria-hidden="true">/</span>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}</Fragment>)}</nav><div className="admin-topbar-actions"><Link href="/" target="_blank" rel="noreferrer" className="admin-visit-link">访问博客<ArrowUpRight size={14} /></Link><LogoutButton variant="ghost" showIcon className="admin-btn admin-btn-ghost" /></div></header>
}
