'use client'

import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchSettings()
  }, [isAuthenticated, authLoading])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/settings') as { code: number; data: SiteSettings; message: string }
      if (result.code === 2000 && result.data) {
        setSettings(result.data)
      }
    } catch {
      // Use default settings
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
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('保存设置失败')
      }
    } catch {
      setError('保存设置失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">系统设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          配置博客的基本信息和功能选项
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
          设置已保存
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Blog Info */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            博客信息
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1">博客名称</label>
            <input
              type="text"
              value={settings.blogName}
              onChange={(e) => setSettings({ ...settings, blogName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">博客描述</label>
            <textarea
              value={settings.blogDescription}
              onChange={(e) => setSettings({ ...settings, blogDescription: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">关键词</label>
            <input
              type="text"
              value={settings.blogKeywords}
              onChange={(e) => setSettings({ ...settings, blogKeywords: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="用逗号分隔"
            />
            <p className="text-xs text-muted-foreground mt-1">
              用于 SEO，多个关键词用逗号分隔
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">OG 图片地址</label>
            <input
              type="url"
              value={settings.ogImage}
              onChange={(e) => setSettings({ ...settings, ogImage: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://example.com/og-image.png"
            />
            <p className="text-xs text-muted-foreground mt-1">
              用于社交分享的图片，建议尺寸 1200x630
            </p>
          </div>
        </div>

        {/* Social Links */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
            社交链接
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1">GitHub</label>
            <input
              type="url"
              value={settings.githubUrl}
              onChange={(e) => setSettings({ ...settings, githubUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://github.com/username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Twitter</label>
            <input
              type="url"
              value={settings.twitterUrl}
              onChange={(e) => setSettings({ ...settings, twitterUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://twitter.com/username"
            />
          </div>
        </div>

        {/* Comment Settings */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            评论设置
          </h2>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoApprove"
              checked={settings.autoApproveComments}
              onChange={(e) => setSettings({ ...settings, autoApproveComments: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="autoApprove" className="text-sm">
              自动审核通过评论
            </label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            开启后，评论将直接显示，无需审核
          </p>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requireEmail"
              checked={settings.requireEmailForComments}
              onChange={(e) => setSettings({ ...settings, requireEmailForComments: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="requireEmail" className="text-sm">
              评论时必须填写邮箱
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  )
}
