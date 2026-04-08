/**
 * CommentSection - 评论组件
 */

'use client'

import { useState, useEffect } from 'react'
import { User, MessageSquare, Send, Reply, Loader2 } from 'lucide-react'
import { api } from '@/client/api'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  nickname: string
  content: string
  createdAt: string
  children?: Comment[]
}

interface CommentSectionProps {
  postId: string
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [captcha, setCaptcha] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')

  useEffect(() => {
    fetchComments()
    fetchCaptcha()
  }, [postId])

  const fetchComments = async () => {
    try {
      setIsLoading(true)
      const result = await api.get('/comments', { postId, pageSize: 50 }) as {
        code: number
        data: { items: Comment[] }
        message: string
      }
      if (result.code === 2000 && result.data) {
        setComments(result.data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCaptcha = async () => {
    try {
      const response = await fetch('/api/captcha?' + Date.now())
      const captchaId = response.headers.get('X-Captcha-Id') || ''
      const svg = await response.text()
      setCaptchaId(captchaId)
      // 使用 encodeURIComponent 处理 SVG，避免 btoa 中文问题
      setCaptchaImage(`data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`)
    } catch (error) {
      console.error('Failed to fetch captcha:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim() || !content.trim() || !captcha.trim()) return

    setIsSubmitting(true)
    setSubmitMessage(null)

    try {
      const result = await api.post('/comments', {
        nickname: nickname.trim(),
        content: content.trim(),
        captcha: captcha.trim(),
        captchaId,
        postId,
      }) as { code: number; message: string }

      if (result.code === 2000 || result.code === 2010) {
        setSubmitMessage({ type: 'success', text: '评论提交成功，等待审核后显示' })
        setNickname('')
        setContent('')
        setCaptcha('')
        fetchCaptcha()
      } else {
        setSubmitMessage({ type: 'error', text: result.message || '评论提交失败' })
      }
    } catch (error: any) {
      setSubmitMessage({ type: 'error', text: error?.message || '评论提交失败' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return (
    <section className="space-y-8 pt-12 border-t border-border">
      <div className="flex items-center gap-2 text-lg font-bold text-text-main">
        <MessageSquare size={20} className="text-primary" />
        评论区
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4 border-b border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              昵称 *
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入昵称"
              maxLength={20}
              className="w-full bg-background dark:bg-sidebar-active/10 border border-border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              验证码 *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                placeholder="4位验证码"
                maxLength={4}
                className="flex-1 bg-background dark:bg-sidebar-active/10 border border-border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
              {captchaImage && (
                <img
                  src={captchaImage}
                  alt="验证码"
                  className="w-24 h-10 bg-primary/10 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={fetchCaptcha}
                  title="点击刷新验证码"
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            内容 *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="说点什么吧... (最多500字)"
            maxLength={500}
            className="w-full bg-background dark:bg-sidebar-active/10 border border-border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-muted">
            * 评论提交后需审核，请勿发布违规内容。
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !nickname.trim() || !content.trim() || !captcha.trim()}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95',
              isSubmitting || !nickname.trim() || !content.trim() || !captcha.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary/90'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Send size={16} />
                发表评论
              </>
            )}
          </button>
        </div>

        {submitMessage && (
          <p className={cn(
            'text-sm font-medium',
            submitMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
          )}>
            {submitMessage.text}
          </p>
        )}
      </form>

      {/* Comment List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8 text-text-muted">加载中...</div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="space-y-4">
              <CommentItem comment={comment} formatDate={formatDate} />
              {/* Replies */}
              {comment.children && comment.children.length > 0 && (
                <div className="ml-14 space-y-4">
                  {comment.children.map((reply) => (
                    <CommentItem key={reply.id} comment={reply} formatDate={formatDate} isReply />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-text-muted">暂无评论，快来抢沙发吧！</div>
        )}
      </div>
    </section>
  )
}

interface CommentItemProps {
  comment: Comment
  formatDate: (date: string) => string
  isReply?: boolean
}

function CommentItem({ comment, formatDate, isReply }: CommentItemProps) {
  return (
    <div className="flex gap-4">
      <div className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0',
        isReply ? 'w-8 h-8 bg-primary/10' : 'w-10 h-10 bg-gray-100 dark:bg-gray-800'
      )}>
        <User size={isReply ? 16 : 20} className={isReply ? 'text-primary' : 'text-text-muted'} />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-text-main">
            {comment.nickname}
          </span>
          <span className="text-xs text-text-muted">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          {comment.content}
        </p>
      </div>
    </div>
  )
}
