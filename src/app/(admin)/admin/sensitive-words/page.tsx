'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/client/api'
import { useAuth } from '../../_components'

interface SensitiveWord {
  id: string
  word: string
  category?: string
  isActive: boolean
  createdAt: string
}

export default function SensitiveWordsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [words, setWords] = useState<SensitiveWord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingWord, setEditingWord] = useState<SensitiveWord | null>(null)
  const [formData, setFormData] = useState({ word: '', category: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return
    fetchWords()
  }, [isAuthenticated, authLoading])

  const fetchWords = async () => {
    try {
      setIsLoading(true)
      const result = await api.get<SensitiveWord[]>('/sensitive-words')
      if (result.success && result.data) {
        setWords(result.data)
      }
    } catch {
      setError('获取敏感词失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingWord) {
        const result = await api.put(`/sensitive-words/${editingWord.id}`, formData)
        if (result.success) {
          fetchWords()
          closeDialog()
        }
      } else {
        const result = await api.post('/sensitive-words', formData)
        if (result.success) {
          fetchWords()
          closeDialog()
        }
      }
    } catch {
      setError(editingWord ? '更新敏感词失败' : '创建敏感词失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (word: SensitiveWord) => {
    setEditingWord(word)
    setFormData({ word: word.word, category: word.category || '' })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个敏感词吗？')) return

    try {
      const result = await api.delete(`/sensitive-words/${id}`)
      if (result.success) {
        fetchWords()
      }
    } catch {
      setError('删除敏感词失败')
    }
  }

  const handleToggle = async (word: SensitiveWord) => {
    try {
      const result = await api.put(`/sensitive-words/${word.id}`, {
        ...word,
        isActive: !word.isActive,
      })
      if (result.success) {
        fetchWords()
      }
    } catch {
      setError('更新状态失败')
    }
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditingWord(null)
    setFormData({ word: '', category: '' })
  }

  const filteredWords = words.filter((w) => {
    if (filter === 'active') return w.isActive
    if (filter === 'inactive') return !w.isActive
    return true
  })

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
          <h1 className="text-2xl font-bold">敏感词管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理评论审核中的敏感词
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          添加敏感词
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 p-1 bg-sidebar rounded-lg w-fit">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f
                ? 'bg-background shadow-sm font-medium'
                : 'hover:bg-background/50'
            }`}
          >
            {f === 'all' ? '全部' : f === 'active' ? '已启用' : '已禁用'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">词汇</th>
              <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">添加时间</th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredWords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  暂无敏感词
                </td>
              </tr>
            ) : (
              filteredWords.map((word) => (
                <tr key={word.id}>
                  <td className="px-4 py-3 font-mono">{word.word}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {word.category || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(word)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        word.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {word.isActive ? '已启用' : '已禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(word.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(word)}
                      className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(word.id)}
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
              {editingWord ? '编辑敏感词' : '添加敏感词'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">词汇</label>
                <input
                  type="text"
                  value={formData.word}
                  onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">分类</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="可选"
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
