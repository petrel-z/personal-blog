import React from 'react'
import Link from 'next/link'
import { Cloud } from 'lucide-react'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Cloud className="text-primary" size={20} />
            <span className="font-bold">Frytea Blog</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="hover:text-primary transition-colors">
              首页
            </Link>
            <Link href="/archive" className="hover:text-primary transition-colors">
              归档
            </Link>
            <Link href="/about" className="hover:text-primary transition-colors">
              关于
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 Frytea Blog. Powered by AI Studio.</p>
        </div>
      </footer>
    </div>
  )
}
