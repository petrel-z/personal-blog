'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '../../_components'
import type { Category } from '@/shared/types'

interface CategoryWithCount extends Category {
  postCount: number
}

export default function CategoriesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      return
    }
    fetchCategories()
  }, [isAuthenticated, authLoading])

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/categories') as { code: number; data: { items: CategoryWithCount[]; total: number; totalPages: number }; message: string }
      if (result.code === 2000 && result.data) {
        setCategories(result.data.items || [])
      }
    } catch {
      setError('获取分类失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingCategory) {
        // Update
        const result = await api.put(`/categories/${editingCategory.id}`, formData)
        if (result.code === 2000) {
          fetchCategories()
          closeDialog()
        }
      } else {
        // Create
        const result = await api.post('/categories', formData)
        if (result.code === 2000) {
          fetchCategories()
          closeDialog()
        }
      }
    } catch {
      setError(editingCategory ? '更新分类失败' : '创建分类失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (category: CategoryWithCount) => {
    setEditingCategory(category)
    setFormData({ name: category.name, slug: category.slug, description: category.description || '' })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个分类吗？')) return

    try {
      const result = await api.delete(`/categories/${id}`)
      if (result.code === 2000) {
        fetchCategories()
      }
    } catch {
      setError('删除分类失败')
    }
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditingCategory(null)
    setFormData({ name: '', slug: '', description: '' })
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
          <h1 className="text-2xl font-bold">分类管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理文章的分类
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          新建分类
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
              <th className="px-4 py-3 text-left text-sm font-medium">文章数</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  暂无分类
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-sm">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {category.description || '-'}
                  </td>
                  <td className="px-4 py-3">{category.postCount || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(category)}
                      className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeDialog} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingCategory ? '编辑分类' : '新建分类'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (!editingCategory) {
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
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                  rows={3}
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
