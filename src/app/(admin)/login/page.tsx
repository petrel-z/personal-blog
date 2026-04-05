'use client'

import React from 'react'
import { LoginForm } from '../_components'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 border rounded-lg bg-card shadow-sm">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold">管理后台登录</h1>
          <p className="text-sm text-muted-foreground">
            请输入管理员账号信息
          </p>
        </div>

        <LoginForm />

        <p className="text-xs text-center text-muted-foreground">
          登录即表示您同意我们的服务条款
        </p>
      </div>
    </div>
  )
}
