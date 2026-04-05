/**
 * CommentSection - 评论组件
 */

'use client'

import { useState } from 'react'
import { User, MessageSquare, Send, RefreshCw, Reply } from 'lucide-react'

interface Comment {
  id: string
  nickname: string
  content: string
  date: string
  replies?: Comment[]
}

const mockComments: Comment[] = [
  {
    id: '1',
    nickname: '张三',
    content: '这篇文章写得非常有深度，特别是关于 ceph 权限那块，解决了我的燃眉之急！',
    date: '2026-04-03 14:20',
    replies: [
      {
        id: '2',
        nickname: '博主',
        content: '很高兴能帮到你！',
        date: '2026-04-03 15:00',
      },
    ],
  },
  {
    id: '3',
    nickname: '李四',
    content: '期待下一篇关于 Kubernetes 调度的文章。',
    date: '2026-04-02 09:15',
  },
]

export function CommentSection() {
  const [captcha, setCaptcha] = useState('A7B9')

  const refreshCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCaptcha(result)
  }

  return (
    <section className="space-y-8 pt-12 border-t border-border">
      <div className="flex items-center gap-2 text-lg font-bold text-text-main">
        <MessageSquare size={20} className="text-primary" />
        评论区
      </div>

      {/* Comment Form */}
      <form className="p-6 space-y-4 border-b border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              昵称 *
            </label>
            <input
              type="text"
              placeholder="请输入昵称"
              className="w-full bg-sidebar-active/20 dark:bg-sidebar-active/10 border border-border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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
                placeholder="4位验证码"
                className="flex-1 bg-sidebar-active/20 dark:bg-sidebar-active/10 border border-border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
              <div
                onClick={refreshCaptcha}
                className="w-24 bg-primary/10 text-primary font-mono font-bold flex items-center justify-center rounded-lg cursor-pointer hover:bg-primary/20 transition-colors select-none"
              >
                {captcha}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            内容 *
          </label>
          <textarea
            rows={4}
            placeholder="说点什么吧... (最多500字)"
            className="w-full bg-sidebar-active/20 dark:bg-sidebar-active/10 border border-border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-muted">
            * 评论提交后需审核，请勿发布违规内容。
          </p>
          <button
            type="submit"
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Send size={16} />
            发表评论
          </button>
        </div>
      </form>

      {/* Comment List */}
      <div className="space-y-6">
        {mockComments.map((comment) => (
          <div key={comment.id} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-text-muted flex-shrink-0">
                <User size={20} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-main">
                    {comment.nickname}
                  </span>
                  <span className="text-xs text-text-muted">{comment.date}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  {comment.content}
                </p>
                <button className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold">
                  <Reply size={12} />
                  回复
                </button>
              </div>
            </div>

            {/* Replies */}
            {comment.replies?.map((reply) => (
              <div
                key={reply.id}
                className="ml-14 flex gap-4 bg-sidebar-active/20 dark:bg-sidebar-active/10 p-4 rounded-xl border border-border/50"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <User size={16} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      {reply.nickname}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {reply.date}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {reply.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
