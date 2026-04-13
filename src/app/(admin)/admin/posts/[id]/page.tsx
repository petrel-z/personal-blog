'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/client/api'
import { useAuth } from '../../../_components'
import { useToast } from '@/components/ui/toaster'
import { Upload, Image as ImageIcon, FileText, X, Plus, Search } from 'lucide-react'
import type { PostWithRelations, Category, Tag } from '@/shared/types'

export default function PostEditPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const id = params.id as string

  const [post, setPost] = useState<Partial<PostWithRelations>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState<{
    title: string
    content: string
    summary: string
    coverImage: string
    categoryId: string
    tags: string[]
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    isPinned: boolean
    createdAt: string
  }>({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    categoryId: '',
    tags: [],
    status: 'DRAFT',
    isPinned: false,
    createdAt: '',
  })

  const [showTagModal, setShowTagModal] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchData()
  }, [isAuthenticated, authLoading])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      const [categoriesResult, tagsResult] = await Promise.all([
        api.get('/categories') as unknown as { code: number; data: Category[]; message: string },
        api.get('/tags') as unknown as { code: number; data: Tag[]; message: string },
      ])

      if (categoriesResult.code === 2000 && categoriesResult.data) {
        setCategories(categoriesResult.data)
      }
      if (tagsResult.code === 2000 && tagsResult.data) {
        setAllTags(tagsResult.data)
      }

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
            tags: p.tags?.map((t) => t.name) || [],
            status: (p.status === 'DELETED' ? 'ARCHIVED' : p.status) as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
            isPinned: p.isPinned || false,
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 16) : '',
          })
        }
      }
    } catch {
      toast({ title: '获取数据失败', variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (publishImmediately = false) => {
    setIsSaving(true)

    try {
      if (!formData.title.trim()) {
        toast({ title: '请输入文章标题', variant: 'warning' })
        setIsSaving(false)
        return
      }
      if (!formData.content.trim()) {
        toast({ title: '请输入文章内容', variant: 'warning' })
        setIsSaving(false)
        return
      }

      const data = {
        ...formData,
        status: publishImmediately ? 'PUBLISHED' : formData.status,
        ...(formData.createdAt && { createdAt: new Date(formData.createdAt).toISOString() }),
      }

      let result
      if (id && id !== 'new') {
        result = await api.patch(`/posts/${id}`, data)
      } else {
        result = await api.post('/posts', data)
      }

      if (result.code === 2000 || result.code === 2010) {
        toast({
          title: publishImmediately ? '文章发布成功' : '文章保存成功',
          variant: 'success',
        })
        if (id === 'new' && result.data) {
          router.push(`/admin/posts/${(result.data as PostWithRelations).id}`)
        } else {
          setTimeout(() => {
            router.push('/admin/posts')
          }, 1500)
        }
      } else {
        let friendlyMessage = result.message || '保存失败，请稍后重试'

        if (result.code === 4010) {
          friendlyMessage = '登录已过期，请重新登录'
        } else if (result.code === 4090) {
          friendlyMessage = result.message || '已存在相同标题的文章，请修改标题后重试'
        } else if (result.code === 4220) {
          friendlyMessage = result.message || '文章内容验证失败，请检查输入'
        } else if (result.code === 5000) {
          friendlyMessage = '服务器错误，请稍后重试'
        }

        toast({ title: friendlyMessage, variant: 'error' })
      }
    } catch {
      toast({ title: '网络错误，请检查网络连接后重试', variant: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTag = (tagName: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter((t) => t !== tagName)
        : [...prev.tags, tagName],
    }))
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setIsCreatingTag(true)
    try {
      const result = await api.post('/tags', {
        name: newTagName.trim(),
        slug: newTagName.trim().toLowerCase().replace(/\s+/g, '-'),
      })
      if (result.code === 2000 || result.code === 2010) {
        // Refresh tags list
        const tagsResult = await api.get('/tags') as unknown as { code: number; data: Tag[]; message: string }
        if (tagsResult.code === 2000 && tagsResult.data) {
          setAllTags(tagsResult.data)
        }
        // Add to selected
        setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTagName.trim()] }))
        setNewTagName('')
        toast({ title: '标签创建成功', variant: 'success' })
      }
    } catch {
      toast({ title: '创建标签失败', variant: 'error' })
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const uploadData = new FormData()
    uploadData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      })
      const result = await res.json()
      if (result.code === 2000) {
        setFormData((prev) => ({ ...prev, coverImage: result.data.url }))
        toast({ title: '封面上传成功', variant: 'success' })
      } else {
        toast({ title: result.message || '封面上传失败', variant: 'error' })
      }
    } catch {
      toast({ title: '封面上传失败，请检查网络连接', variant: 'error' })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const input = fileInputRef.current
      if (input) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        input.files = dataTransfer.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }

  const filteredTags = useMemo(() => {
    return allTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
        !formData.tags.includes(tag.name)
    )
  }, [allTags, tagSearch, formData.tags])

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background">
      {/* Tag Selection Modal */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTagModal(false)} />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-medium">选择标签</h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="搜索标签..."
                  className="w-full pl-10 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Existing Tags */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.name)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded-md flex items-center justify-between"
                    >
                      <span>{tag.name}</span>
                      {formData.tags.includes(tag.name) && (
                        <span className="text-primary">✓</span>
                      )}
                    </button>
                  ))
                ) : tagSearch ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    没有找到匹配的标签
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无标签
                  </p>
                )}
              </div>

              {/* Create New Tag */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium mb-2">创建新标签</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="输入新标签名称"
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  />
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isCreatingTag}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              </div>

              {/* Selected Tags Summary */}
              {formData.tags.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    已选择 {formData.tags.length} 个标签
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t px-6 py-4 lg:left-64">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-accent disabled:opacity-50 transition-colors"
          >
            保存草稿
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? '发布中...' : formData.status === 'PUBLISHED' ? '更新发布' : '发布'}
          </button>
        </div>
      </div>

      <div className="p-6 pb-24 space-y-6">
        {/* Main Editor Area */}
        <div className="space-y-4">
          {/* Title */}
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="请输入文章标题"
            className="w-full text-3xl font-bold border-0 bg-transparent pb-4 focus:outline-none placeholder:text-muted-foreground/50"
          />

          {/* Content - Auto expanding */}
          <div className="relative">
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="请输入文章内容..."
              className="w-full min-h-[500px] p-4 border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              style={{ height: 'auto', minHeight: '500px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.max(500, target.scrollHeight) + 'px'
              }}
            />
          </div>
        </div>

        {/* Article Settings Card */}
        <div className="border rounded-lg bg-card">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <h3 className="font-medium text-sm">文章设置</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div>
              <label className="block text-sm font-medium mb-2">摘要</label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="文章摘要（可选）"
                className="w-full p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                rows={3}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">分类</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">未分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-2">标签</label>

              {/* Selected Tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.tags.map((tagName) => (
                    <span
                      key={tagName}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                    >
                      {tagName}
                      <button
                        type="button"
                        onClick={() => toggleTag(tagName)}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Tag Button */}
              <button
                type="button"
                onClick={() => {
                  setShowTagModal(true)
                  setTagSearch('')
                  setNewTagName('')
                }}
                className="w-full px-3 py-2 text-sm border border-dashed rounded-md hover:border-primary/50 hover:bg-accent/50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                添加文章标签
              </button>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-2">状态</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' })
                }
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="DRAFT">草稿</option>
                <option value="PUBLISHED">已发布</option>
                <option value="ARCHIVED">归档</option>
              </select>
            </div>

            {/* Publish Settings */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="isPinned"
                checked={formData.isPinned}
                onChange={(e) =>
                  setFormData({ ...formData, isPinned: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="isPinned" className="text-sm cursor-pointer">
                置顶文章
              </label>
            </div>

            {/* Created At */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-2">创建时间</label>
              <input
                type="datetime-local"
                value={formData.createdAt}
                onChange={(e) =>
                  setFormData({ ...formData, createdAt: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                设置文章的创建时间
              </p>
            </div>
          </div>
        </div>

        {/* Cover Image Card */}
        <div className="border rounded-lg bg-card">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            <h3 className="font-medium text-sm">封面图片</h3>
          </div>
          <div className="p-4">
            {/* Upload/Preview Area */}
            <div
              className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group w-64 aspect-video"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {formData.coverImage ? (
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.coverImage}
                    alt="封面预览"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      className="px-4 py-2 bg-white text-black text-sm rounded-full"
                    >
                      更换图片
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setFormData((prev) => ({ ...prev, coverImage: '' }))
                      }}
                      className="px-4 py-2 bg-red-500 text-white text-sm rounded-full"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    点击上传，或拖拽图片到这里
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    支持 JPG、PNG 格式，建议 16:9 比例
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
