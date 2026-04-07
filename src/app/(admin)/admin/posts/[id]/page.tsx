'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/client/api'
import { useAuth } from '../../../_components'
import type { PostWithRelations, Category, Tag } from '@/shared/types'

export default function PostEditPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const id = params.id as string

  const [post, setPost] = useState<Partial<PostWithRelations>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    title: string
    content: string
    summary: string
    coverImage: string
    categoryId: string
    tags: string[]
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    isPinned: boolean
  }>({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    categoryId: '',
    tags: [],
    status: 'DRAFT',
    isPinned: false,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchData()
  }, [isAuthenticated, authLoading])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // Fetch categories and tags in parallel
      const [categoriesResult, tagsResult] = await Promise.all([
        api.get('/categories') as unknown as { code: number; data: Category[]; message: string },
        api.get('/tags') as unknown as { code: number; data: Tag[]; message: string },
      ])

      if (categoriesResult.code === 2000 && categoriesResult.data) {
        // API returns data as array directly
        setCategories(categoriesResult.data)
      }
      if (tagsResult.code === 2000 && tagsResult.data) {
        setAllTags(tagsResult.data)
      }

      // Fetch post if editing
      if (id && id !== 'new') {
        const postResult = await api.get(`/posts/${id}`) as unknown as { code: number; data: PostWithRelations; message: string }
        if (postResult.code === 2000 && postResult.data) {
          const p = postResult.data as PostWithRelations & { isPinned?: boolean }
          setPost(p)
          setFormData({
            title: p.title || '',
            content: p.content || '',
            summary: p.summary || '',
            coverImage: p.coverImage || '',
            categoryId: p.category?.id || '',
            tags: p.tags?.map(t => t.name) || [],
            status: (p.status === 'DELETED' ? 'ARCHIVED' : p.status) as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
            isPinned: p.isPinned || false,
          })
        }
      }
    } catch {
      setError('获取数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = useCallback(async (publishImmediately = false) => {
    setIsSaving(true)
    setSaveStatus('saving')
    setError(null)

    try {
      const data = {
        ...formData,
        status: publishImmediately ? 'PUBLISHED' : formData.status,
      }

      let result
      if (id && id !== 'new') {
        result = await api.patch(`/posts/${id}`, data)
      } else {
        result = await api.post('/posts', data)
      }

      if (result.code === 2000 || result.code === 2010) {
        setSaveStatus('saved')
        if (id === 'new' && result.data) {
          // Redirect to edit page with new ID
          router.push(`/admin/posts/${(result.data as PostWithRelations).id}`)
        } else {
          // After saving existing post, redirect to posts list after showing success
          setTimeout(() => {
            router.push('/admin/posts')
          }, 1500)
        }
      } else {
        setSaveStatus('error')
        setError(result.message || '保存失败')
      }
    } catch {
      setSaveStatus('error')
      setError('保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [formData, id, router])

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
          <h1 className="text-2xl font-bold">
            {id === 'new' ? '写文章' : '编辑文章'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {id === 'new' ? '创建新文章' : `编辑: ${post.title}`}
          </p>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-4">
          {saveStatus === 'saving' && (
            <span className="text-sm text-muted-foreground">保存中...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600">已保存</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600">保存失败</span>
          )}

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
            {formData.status === 'PUBLISHED' ? '更新发布' : '发布'}
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
          {/* Title */}
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="文章标题"
            className="w-full text-2xl font-bold border-0 border-b bg-transparent pb-2 focus:outline-none focus:border-primary"
          />

          {/* Content */}
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="开始写作..."
            className="w-full h-96 p-4 border rounded-lg resize-none font-mono text-sm"
          />

          {/* Summary */}
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
          {/* Publish Settings */}
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

            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="DRAFT">草稿</option>
                <option value="PUBLISHED">已发布</option>
                <option value="ARCHIVED">归档</option>
              </select>
            </div>
          </div>

          {/* Category */}
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

          {/* Tags */}
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
            {formData.tags.length > 0 && (
              <p className="text-xs text-muted-foreground">
                已选择: {formData.tags.join(', ')}
              </p>
            )}
          </div>

          {/* Cover Image */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">封面图片</h3>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                placeholder="图片 URL"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <label className="px-4 py-2 bg-sidebar hover:bg-sidebar-active text-sm rounded-lg cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    const uploadFormData = new FormData()
                    uploadFormData.append('file', file)

                    try {
                      const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: uploadFormData,
                      })
                      const result = await res.json()
                      if (result.code === 2000) {
                        setFormData((prev) => ({ ...prev, coverImage: result.data.url }))
                      } else {
                        alert(result.message || '上传失败')
                      }
                    } catch {
                      alert('上传失败')
                    }
                  }}
                />
                上传
              </label>
            </div>
            {formData.coverImage && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-sidebar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.coverImage}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
