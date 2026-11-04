'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { LoginForm } from '../(admin)/_components'
import { AuthLayout } from '@/components/admin/AuthLayout'

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="auth-heading">
        <h1>欢迎回来</h1>
        <p>登录你的内容管理空间</p>
      </div>
      <Suspense fallback={<div role="status" className="flex items-center gap-2 py-8"><Loader2 className="animate-spin" size={18} />正在加载登录表单…</div>}>
        <LoginForm />
      </Suspense>
      <p className="auth-switch">还没有账号？<Link href="/register">创建账号</Link></p>
      <p className="auth-permissions">普通会员无后台权限，请联系博主授权。</p>
    </AuthLayout>
  )
}
