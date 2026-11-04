import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import './admin.css'
import './auth.css'

export function AuthLayout({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <div className={`admin-theme auth-layout${centered ? ' auth-layout-centered' : ''}`}>
      {!centered && (
        <aside className="auth-brand-panel" aria-label="Petrel">
          <Link href="/" className="auth-brand"><span>P</span>PETREL</Link>
          <div className="auth-brand-story">
            <h2>把想法留下，<br />让时间回答。</h2>
            <p>一个安静、有序的内容空间。</p>
            <div className="auth-paper-stack" aria-hidden="true">
              <div className="auth-paper">
                <small>NOTES / 001</small><i />
                <strong>记录，让灵感生长。</strong>
                <div className="auth-paper-lines"><span /><span /><span /></div>
                <em>慢慢写，认真记。</em>
              </div>
            </div>
          </div>
          <small className="auth-brand-footer">LESS NOISE. MORE THOUGHT.</small>
        </aside>
      )}
      <div className="auth-main">
        <header className="auth-topbar">
          <Link href="/" className="auth-mobile-brand">PETREL</Link>
          <Link href="/" className="auth-back">返回博客 <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </header>
        <main className="auth-content">{children}</main>
        <footer className="auth-footer">© {new Date().getFullYear()} Petrel</footer>
      </div>
    </div>
  )
}
