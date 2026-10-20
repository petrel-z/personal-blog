'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAccessAdminPage, type Permission } from '@/shared/permissions'

interface AuthContextType {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
  } | null
  isLoading: boolean
  isAuthenticated: boolean
  can: (permission: Permission) => boolean
  permissions: readonly Permission[]
  signOut: (callbackUrl?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  can: () => false,
  permissions: [],
  signOut: async () => {},
})

export function AuthProvider({ children, permissions }: { children: React.ReactNode; permissions: readonly Permission[] }) {
  const pathname = usePathname()
  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions])
  const { data: session, status } = useSession()

  const isAuthenticated = status === 'authenticated' && !!session?.user
  const isLoading = status === 'loading'

  const signOut = useCallback(async (callbackUrl?: string) => {
    await nextAuthSignOut({
      callbackUrl: callbackUrl || '/login',
      redirect: true,
    })
  }, [])

  const value = {
    user: session?.user as AuthContextType['user'],
    isLoading,
    isAuthenticated,
    can,
    permissions,
    signOut,
  }

  // Prevent flashing on auth state change
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !canAccessAdminPage(permissions, pathname)) {
    const firstAllowed = permissions.includes('post:read') ? '/admin/posts'
      : permissions.includes('comment:read') ? '/admin/comments' : '/'
    return (
      <div className="p-8 space-y-4">
        <p>此账号没有访问该页面的权限。</p>
        <Link href={isAuthenticated ? firstAllowed : '/login'} className="text-primary hover:underline">
          {isAuthenticated ? '返回可访问的页面' : '重新登录'}
        </Link>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for protected routes
export function useRequireAuth(redirectUrl = '/login') {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectUrl)
    }
  }, [isAuthenticated, isLoading, redirectUrl, router])

  return { isAuthenticated, isLoading }
}

// Import useRouter for the hook
import { useRouter } from 'next/navigation'
