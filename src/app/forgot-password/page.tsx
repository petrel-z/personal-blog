import type { Metadata } from 'next'
import { AuthLayout } from '@/components/admin/AuthLayout'
import { PasswordResetForm } from './_components/PasswordResetForm'

export const metadata: Metadata = { title: '忘记密码' }

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="auth-heading">
        <h1>忘记密码</h1>
        <p>通过注册邮箱找回你的账号</p>
      </div>
      <PasswordResetForm />
    </AuthLayout>
  )
}
