import type { Metadata } from 'next'
import { KeyRound } from 'lucide-react'
import { PasswordResetForm } from './_components/PasswordResetForm'

export const metadata: Metadata = { title: '忘记密码' }

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 border rounded-lg bg-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">忘记密码</h1>
          <p className="text-sm text-muted-foreground">通过注册邮箱找回你的账号</p>
        </div>
        <PasswordResetForm />
      </div>
    </main>
  )
}
