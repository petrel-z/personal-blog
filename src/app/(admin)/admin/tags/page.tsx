'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { Tag } from '@/shared/types'

interface TagWithCount extends Tag {
  postCount: number
}

export default function TagsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      return
    }
    fetchTags()
  }, [isAuthenticated, authLoading])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/tags') as { code: number; data: { items: TagWithCount[]; total: number; totalPages: number }; message: string }
      if (result.code === 2000 && result.data) {
        setTags(result.data.items || [])
      }
    } catch {
      setError('获取标签失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingTag) {
        const result = await api.put(`/tags/${editingTag.id}`, formData)
        if (result.code === 2000) {
          fetchTags()
          closeDialog()
        }
      } else {
        const result = await api.post('/tags', formData)
        if (result.code === 2000) {
          fetchTags()
          closeDialog()
        }
      }
    } catch {
      setError(editingTag ? '更新标签失败' : '创建标签失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (tag: TagWithCount) => {
    setEditingTag(tag)
    setFormData({ name: tag.name, slug: tag.slug })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个标签吗？')) return

    try {
      const result = await api.delete(`/tags/${id}`)
      if (result.code === 2000) {
        fetchTags()
      }
    } catch {
      setError('删除标签失败')
    }
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditingTag(null)
    setFormData({ name: '', slug: '' })
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
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
          <h1 className="text-2xl font-bold">标签管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理文章的标签
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          新建标签
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Tags Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tags.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            暂无标签
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{tag.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {tag.slug}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {tag.postCount || 0} 篇文章
                  </p>
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t">
                <button
                  onClick={() => handleEdit(tag)}
                  className="flex-1 px-2 py-1 text-xs hover:bg-accent rounded transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="flex-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeDialog} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingTag ? '编辑标签' : '新建标签'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (!editingTag) {
                      setFormData((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 border rounded-lg hover:bg-accent"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
