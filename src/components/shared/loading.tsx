import { type ReactNode } from 'react'
import { Suspense } from 'react'

interface LoadingProps {
  children: ReactNode
  fallback?: ReactNode
}

export function PageLoading({ children, fallback }: LoadingProps) {
  return (
    <Suspense fallback={fallback || <DefaultLoading />}>
      {children}
    </Suspense>
  )
}

function DefaultLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-text-muted">加载中...</span>
      </div>
    </div>
  )
}
