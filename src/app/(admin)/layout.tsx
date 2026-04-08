'use client'

import React, { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from './_components'
import { AdminSidebar } from './_components/AdminSidebar'
import { AdminHeader } from './_components/AdminHeader'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SessionProvider>
      <AuthProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          <AdminSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
            <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
    </SessionProvider>
  )
}
