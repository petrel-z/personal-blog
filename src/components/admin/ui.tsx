'use client'

import { useId, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight, Inbox, Loader2, Search, X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="admin-page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</div>
}

export function AdminPanel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={clsx('admin-panel', className)}>{title && <div className="admin-panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>}{children}</section>
}

export function AdminState({ kind = 'empty', title, description, onRetry, action }: { kind?: 'empty' | 'loading' | 'error'; title?: string; description?: string; onRetry?: () => void; action?: ReactNode }) {
  const Icon = kind === 'loading' ? Loader2 : kind === 'error' ? AlertCircle : Inbox
  return <div className="admin-state" role={kind === 'error' ? 'alert' : 'status'}><span className="admin-state-icon"><Icon size={25} strokeWidth={1.5} className={kind === 'loading' ? 'animate-spin' : ''} /></span><h3>{title ?? (kind === 'loading' ? '正在加载…' : kind === 'error' ? '暂时无法获取数据' : '这里还没有内容')}</h3>{description && <p>{description}</p>}{onRetry && <button className="admin-btn admin-btn-secondary" onClick={onRetry}>重新加载</button>}{action}</div>
}

export function AdminBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'blue' }) {
  return <span className={clsx('admin-badge', `admin-badge-${tone}`)}><span aria-hidden="true" />{children}</span>
}

export function AdminDialog({ open, onClose, title, description, children, busy = false, className }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; busy?: boolean; className?: string }) {
  const descriptionId = useId()
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose() }}><Dialog.Portal><Dialog.Overlay className="admin-theme admin-dialog-overlay" /><Dialog.Content className={clsx('admin-theme admin-dialog', className)} onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onPointerDownOutside={event => { if (busy) event.preventDefault() }} aria-describedby={description ? descriptionId : undefined}><div className="admin-dialog-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close disabled={busy} className="admin-icon-btn" aria-label="关闭弹窗"><X size={18} /></Dialog.Close></div>{description && <Dialog.Description id={descriptionId} className="admin-dialog-description">{description}</Dialog.Description>}{children}</Dialog.Content></Dialog.Portal></Dialog.Root>
}

export function AdminPagination({ page, totalPages, onPageChange, total, disabled = false }: { page: number; totalPages: number; onPageChange: (page: number) => void; total?: number; disabled?: boolean }) {
  return <nav className="admin-pagination" aria-label="分页"><span>{total !== undefined ? `共 ${total} 条` : `第 ${page} 页`}</span><div><button className="admin-icon-btn" aria-label="上一页" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}><ArrowLeft size={16} /></button><span aria-current="page">{page} / {Math.max(1, totalPages)}</span><button className="admin-icon-btn" aria-label="下一页" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}><ArrowRight size={16} /></button></div></nav>
}

export function AdminSearch({ value, onChange, placeholder = '搜索…', label = '搜索' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  return <label className="admin-search"><Search size={16} aria-hidden="true" /><span className="sr-only">{label}</span><input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>
}
