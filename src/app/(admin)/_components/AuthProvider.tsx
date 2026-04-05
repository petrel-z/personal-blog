'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import type { Session } from 'next-auth'

interface AuthContextType {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
  } | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: (callbackUrl?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
