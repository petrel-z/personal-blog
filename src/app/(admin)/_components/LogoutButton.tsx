'use client'

import React, { useState } from 'react'
import { useAuth } from './AuthProvider'
import { clsx } from 'clsx'

interface LogoutButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
  showIcon?: boolean
}

export function LogoutButton({
  variant = 'default',
  className,
  showIcon = true,
}: LogoutButtonProps) {
  const { signOut } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoading(false)
    }
  }

  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors'

  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent',
  }

  const disabledClasses = 'disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        disabledClasses,
        className
      )}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : showIcon ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ) : null}
      <span>退出登录</span>
    </button>
  )
}
