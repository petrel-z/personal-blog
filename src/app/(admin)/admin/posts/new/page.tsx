'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '../../../_components'
import type { Category, Tag } from '@/shared/types'

export default function NewPostPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    categoryId: '',
    tags: [] as string[],
    status: 'DRAFT' as const,
    isPinned: false,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchData()
  }, [isAuthenticated, authLoading])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      const [categoriesResult, tagsResult] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<Tag[]>('/tags'),
      ])

      if (categoriesResult.success) {
        setCategories(categoriesResult.data || [])
      }
      if (tagsResult.success) {
        setAllTags(tagsResult.data || [])
      }
    } catch {
      setError('获取数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (publishImmediately = false) => {
    setIsSaving(true)
    setError(null)

    try {
      const data = {
        ...formData,
        status: publishImmediately ? 'PUBLISHED' : formData.status,
      }

      const result = await api.post('/posts', data)

      if (result.success) {
        // Redirect to posts list
        window.location.href = '/admin/posts'
      } else {
        setError('保存失败')
      }
    } catch {
      setError('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTagToggle = (tagName: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName],
    }))
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">写文章</h1>
          <p className="text-sm text-muted-foreground mt-1">创建新文章</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-4 py-2 border rounded-lg hover:bg-accent disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            发布
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Main Editor */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Editor Area */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="文章标题"
            className="w-full text-2xl font-bold border-0 border-b bg-transparent pb-2 focus:outline-none focus:border-primary"
          />

          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="开始写作..."
            className="w-full h-96 p-4 border rounded-lg resize-none font-mono text-sm"
          />

          <div>
            <label className="block text-sm font-medium mb-1">摘要</label>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="文章摘要（可选）"
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">发布设置</h3>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPinned"
                checked={formData.isPinned}
                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isPinned" className="text-sm">置顶文章</label>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">分类</h3>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">未分类</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">标签</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.name)}
                  className={`px-2 py-1 text-sm rounded-full transition-colors ${
                    formData.tags.includes(tag.name)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-sidebar hover:bg-sidebar-active'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">封面图片</h3>
            <input
              type="url"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              placeholder="图片 URL"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
