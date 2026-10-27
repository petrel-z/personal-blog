'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminPanel, AdminState, AdminDialog, AdminBadge, AdminPagination } from '@/components/admin/ui'
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingWord, setEditingWord] = useState<SensitiveWord | null>(null)
  const [formData, setFormData] = useState({ word: '', category: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const fetchWords = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const result = await api.get('/sensitive-words', { page, pageSize: 20 }) as { code: number; data: { items: SensitiveWord[]; total: number; totalPages: number }; message: string }
      if (result.code === 2000 && result.data) {
        setWords(result.data.items || [])
        setTotalPages(result.data.totalPages || 1)
        setTotal(result.data.total || 0)
      } else { setLoadError(result.message || '获取敏感词失败') }
    } catch {
      setLoadError('获取敏感词失败')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    void fetchWords()
  }, [isAuthenticated, authLoading, fetchWords])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (editingWord) {
        const result = await api.put(`/sensitive-words/${editingWord.id}`, formData)
        if (result.code === 2000 || result.code === 2010) {
          fetchWords()
          closeDialog()
        } else { setError(result.message || '保存敏感词失败，请重试') }
      } else {
        const result = await api.post('/sensitive-words', formData)
        if (result.code === 2000 || result.code === 2010) {
          fetchWords()
          closeDialog()
        } else { setError(result.message || '保存敏感词失败，请重试') }
      }
    } catch {
      setError(editingWord ? '更新敏感词失败' : '创建敏感词失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (word: SensitiveWord) => {
    setError(null)
    setEditingWord(word)
    setFormData({ word: word.word, category: word.category || '' })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个敏感词吗？')) return

    try {
      const result = await api.delete(`/sensitive-words/${id}`)
      if (result.code === 2000) {
        fetchWords()
      } else { setError(result.message || '操作失败，请重试') }
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
      if (result.code === 2000) {
        fetchWords()
      } else { setError(result.message || '操作失败，请重试') }
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

  return (
    <div className="space-y-6">
      <AdminPageHeader title="敏感词管理" description="维护评论审核词库，停用的词汇不会参与匹配。" actions={<button className="admin-btn admin-btn-primary" onClick={() => { setError(null); setShowDialog(true) }}>添加敏感词</button>} />
      {error && !showDialog && <p role="alert" className="admin-notice admin-notice-error">{error}</p>}
      <AdminPanel>
      {/* Filter */}
      <div className="admin-tabs" aria-label="筛选敏感词（当前页）">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            data-active={filter === f}
          >
            {f === 'all' ? '全部' : f === 'active' ? '已启用' : '已禁用'}
          </button>
        ))}
      </div>

      {authLoading || isLoading ? <AdminState kind="loading" title="正在加载敏感词…" /> : loadError ? <AdminState kind="error" title="词库加载失败" description={loadError} onRetry={() => void fetchWords()} /> : filteredWords.length === 0 ? <AdminState title="暂无敏感词" description="添加词汇后，即可用于评论审核。筛选仅作用于当前页。" /> : <>
      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile">
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
                  <td data-label="词汇" className="font-medium">{word.word}</td>
                  <td data-label="分类">
                    {word.category || '-'}
                  </td>
                  <td data-label="状态">
                    <button
                      onClick={() => handleToggle(word)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        word.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <AdminBadge tone={word.isActive ? 'success' : 'neutral'}>{word.isActive ? '已启用' : '已禁用'}</AdminBadge>
                    </button>
                  </td>
                  <td data-label="添加时间">
                    {new Date(word.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td data-label="操作">
                    <button
                      onClick={() => handleEdit(word)}
                      className="admin-btn admin-btn-ghost"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(word.id)}
                      className="admin-btn admin-btn-danger"
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

      </>}
      {!isLoading && !loadError && <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />}
      </AdminPanel>
      {showDialog && <AdminDialog open onClose={closeDialog} busy={isSubmitting} title={editingWord ? '编辑敏感词' : '添加敏感词'} description="设置需要在评论审核中识别的词汇。">
        <form onSubmit={handleSubmit} className="admin-form">
          {error && <p role="alert" className="admin-notice admin-notice-error">{error}</p>}
          <div className="admin-field"><label htmlFor="sensitive-word">词汇</label><input id="sensitive-word" value={formData.word} maxLength={50} required onChange={event => setFormData({ ...formData, word: event.target.value })} /></div>
          <div className="admin-field"><label htmlFor="sensitive-category">分类</label><input id="sensitive-category" value={formData.category} maxLength={20} placeholder="可选" onChange={event => setFormData({ ...formData, category: event.target.value })} /></div>
          <div className="admin-dialog-footer"><button type="button" className="admin-btn admin-btn-secondary" disabled={isSubmitting} onClick={closeDialog}>取消</button><button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>{isSubmitting ? '保存中...' : '保存'}</button></div>
        </form>
      </AdminDialog>}
    </div>
  )
}
