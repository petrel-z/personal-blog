import React from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar Placeholder */}
        <aside className="w-64 border-r bg-sidebar min-h-screen hidden lg:block">
          <div className="p-4">
            <h2 className="font-bold text-lg">管理后台</h2>
          </div>
          <nav className="px-2 space-y-1">
            <NavItem href="/admin/dashboard" label="仪表盘" />
            <NavItem href="/admin/posts" label="文章管理" />
            <NavItem href="/admin/comments" label="评论管理" />
            <NavItem href="/admin/settings" label="系统设置" />
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="flex h-14 items-center justify-between px-6">
              <h1 className="font-semibold">管理面板</h1>
              <div className="flex items-center gap-4">
                <a href="/" className="text-sm text-muted-foreground hover:text-primary">
                  返回前台
                </a>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-4 py-2 text-sm rounded-lg hover:bg-sidebar-active transition-colors"
    >
      {label}
    </a>
  )
}
