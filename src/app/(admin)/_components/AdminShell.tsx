'use client'

import React, { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from './AuthProvider'
import type { Permission } from '@/shared/permissions'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'

export default function AdminShell({ children, permissions }: { children: React.ReactNode; permissions: readonly Permission[] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return <div className="admin-theme admin-layout"><SessionProvider><AuthProvider permissions={permissions}><a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] admin-btn admin-btn-primary">跳转到主要内容</a><AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="admin-body"><AdminHeader onMenuClick={() => setSidebarOpen(true)} menuOpen={sidebarOpen} /><main id="admin-content" className="admin-main" tabIndex={-1}>{children}<footer className="admin-footer"><span>PETREL / CONTENT STUDIO</span><span>认真记录，自在表达。</span></footer></main></div></AuthProvider></SessionProvider></div>
}
