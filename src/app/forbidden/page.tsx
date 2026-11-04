import Link from 'next/link'
import { Shield } from 'lucide-react'
import { AuthLayout } from '@/components/admin/AuthLayout'

export default function ForbiddenPage() {
  return (
    <AuthLayout centered>
      <div className="auth-forbidden">
        <div className="auth-forbidden-icon"><Shield size={38} strokeWidth={1.3} aria-hidden="true" /></div>
        <h1>当前账号没有后台访问权限</h1>
        <p>你已登录，但尚未获得管理权限。</p>
        <p>请联系博主，为账号分配合适的角色。</p>
        <div className="auth-forbidden-actions">
          <Link href="/" className="admin-btn admin-btn-primary">返回博客首页</Link>
          <Link href="/login" className="admin-btn admin-btn-secondary">切换登录账号</Link>
        </div>
        <small>403 / ACCESS RESTRICTED</small>
      </div>
    </AuthLayout>
  )
}
