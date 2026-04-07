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
        <div className="flex min-h-screen bg-background">
          <AdminSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex-1 ">
            <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

            <main className="p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
    </SessionProvider>
  )
}
