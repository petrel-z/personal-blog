'use client'

import { ErrorBoundary as ReactErrorBoundary } from './error-boundary'
import type { ReactNode } from 'react'

interface PageErrorProps {
  children: ReactNode
}

export function PageError({ children }: PageErrorProps) {
  return <ReactErrorBoundary>{children}</ReactErrorBoundary>
}
