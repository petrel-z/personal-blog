'use client'

import React, { useEffect, useState } from 'react'
import { AdminPageHeader, AdminPanel, AdminState } from '@/components/admin/ui'
import { api } from '@/client/api'
import { useAuth } from '../../_components'

interface SiteSettings {
  blogName: string
  blogDescription: string
  blogKeywords: string
  ogImage: string
  githubUrl: string
  twitterUrl: string
  autoApproveComments: boolean
  requireEmailForComments: boolean
}

const tabLabels = { basic: '基本信息', social: '社交链接', comments: '评论设置' }
const basicFields = [['blogName', '博客名称', ''], ['blogDescription', '博客描述', '简短介绍博客关注的内容。'], ['blogKeywords', '关键词', '用于 SEO，多个关键词用逗号分隔。'], ['ogImage', 'OG 图片地址', '用于社交分享，建议尺寸 1200 × 630。']] as const
const socialFields = [['githubUrl', 'GitHub', ''], ['twitterUrl', 'Twitter', '']] as const

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [settings, setSettings] = useState<SiteSettings>({
    blogName: '',
    blogDescription: '',
    blogKeywords: '',
    ogImage: '',
    githubUrl: '',
    twitterUrl: '',
    autoApproveComments: false,
    requireEmailForComments: true,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<keyof typeof tabLabels>('basic')

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    fetchSettings()
  }, [isAuthenticated, authLoading])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const result = await api.get('/settings') as { code: number; data: SiteSettings; message: string }
      if (result.code === 2000 && result.data) {
        setSettings(result.data)
      } else { setLoadError(result.message || '获取设置失败') }
    } catch {
      setLoadError('获取设置失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await api.put('/settings', settings)
      if (result.code === 2000) {
        setSuccess(true)

      } else {
        setError(result.message || '保存设置失败')
      }
    } catch {
      setError('保存设置失败')
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="space-y-6">
    <AdminPageHeader title="系统设置" description="配置博客的基本信息、社交链接与评论规则。" />
    {authLoading || isLoading ? <AdminState kind="loading" title="正在加载设置…" /> : loadError ?
      <AdminState kind="error" title="设置加载失败" description={loadError} onRetry={() => void fetchSettings()} /> :
      <AdminPanel>
        <div className="admin-tabs" role="tablist" aria-label="设置分组">
          {(['basic', 'social', 'comments'] as const).map(key => <button type="button" role="tab" id={`settings-tab-${key}`} aria-controls={`settings-panel-${key}`} key={key} aria-selected={tab === key} onClick={() => setTab(key)}>{tabLabels[key]}</button>)}
        </div>
        <form onSubmit={handleSubmit} className="admin-form p-6 md:p-8">
          {error && <p role="alert" className="admin-notice admin-notice-error">{error}，请重试。已保留本次填写内容。</p>}
          {success && <p role="status" className="admin-notice">设置已保存</p>}
          <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_300px]"><section role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} className="max-w-2xl space-y-6">
            <div><h2 className="text-base font-semibold">{tabLabels[tab]}</h2><p className="mt-2 text-sm text-muted-foreground">{tab === 'basic' ? '这些信息将用于网站展示、搜索引擎与社交分享。' : tab === 'social' ? '填写完整链接，留空则不展示对应入口。' : '设置访客评论的审核方式与信息要求。'}</p></div>
            {tab !== 'comments' ? (tab === 'basic' ? basicFields : socialFields).map(([key, label, hint]) => <div className="admin-field" key={key}>
              <label htmlFor={`setting-${key}`}>{label}</label>
              {key === 'blogDescription' ? <textarea id={`setting-${key}`} rows={4} value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })} /> :
                <input id={`setting-${key}`} type={['ogImage', 'githubUrl', 'twitterUrl'].includes(key) ? 'url' : 'text'} value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })} />}
              {hint && <small>{hint}</small>}
            </div>) : <>
              <label className="flex items-start gap-3 rounded-lg border p-5"><input className="mt-1" type="checkbox" checked={settings.autoApproveComments} onChange={event => setSettings({ ...settings, autoApproveComments: event.target.checked })} /><span><span className="block text-sm font-medium">自动审核通过评论</span><span className="mt-2 block text-xs text-muted-foreground">开启后，评论将直接显示，无需人工审核。</span></span></label>
              <label className="flex items-start gap-3 rounded-lg border p-5"><input className="mt-1" type="checkbox" checked={settings.requireEmailForComments} onChange={event => setSettings({ ...settings, requireEmailForComments: event.target.checked })} /><span><span className="block text-sm font-medium">评论时必须填写邮箱</span><span className="mt-2 block text-xs text-muted-foreground">要求访客留下邮箱，以便接收评论回复。</span></span></label>
            </>}
          </section>
          <aside className="rounded-lg border bg-background p-5" aria-label="设置预览">
            <p className="mb-5 text-xs text-muted-foreground">{tab === 'basic' ? '分享预览' : tab === 'social' ? '社交入口预览' : '评论规则预览'}</p>
            {tab === 'basic' ? <>
              {settings.ogImage ? <div className="mb-4 aspect-[1200/630] rounded-md bg-cover bg-center" role="img" aria-label="分享封面" style={{ backgroundImage: `url(${JSON.stringify(settings.ogImage)})` }} /> : <div className="mb-4 flex aspect-[1200/630] items-center justify-center rounded-md border bg-card text-xs text-muted-foreground">分享封面</div>}
              <h3 className="break-words text-base font-semibold">{settings.blogName || '你的博客名称'}</h3>
              <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">{settings.blogDescription || '在这里，让读者认识你的博客。'}</p>
            </> : tab === 'social' ? <div className="space-y-4 text-sm">{socialFields.map(([key, label]) => <div key={key}><strong>{label}</strong><p className="mt-1 break-all text-xs text-muted-foreground">{settings[key] || '未设置 · 不显示入口'}</p></div>)}</div> : <div className="space-y-4 text-sm leading-relaxed"><p>{settings.autoApproveComments ? '评论自动通过审核；命中敏感词时仍按审核规则处理。' : '新评论需要管理员审核后展示。'}</p><p>{settings.requireEmailForComments ? '提交评论时，访客需要填写邮箱。' : '邮箱为选填项。'}</p></div>}
            <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">此处展示当前填写内容，保存后生效。</p>
          </aside></div>
          <div className="admin-dialog-footer"><p className="mr-auto text-xs text-muted-foreground">切换分组会保留未保存内容；保存将应用全部设置。</p><button type="submit" disabled={isSaving} className="admin-btn admin-btn-primary">{isSaving ? '保存中...' : '保存设置'}</button></div>
        </form>
      </AdminPanel>}
  </div>
}
