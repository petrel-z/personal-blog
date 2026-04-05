'use client'

import * as React from 'react'

interface ToastProps {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

const ToastContext = React.createContext<{
  toast: (props: ToastProps) => void
} | null>(null)

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback((props: ToastProps) => {
    setToasts((prev) => [...prev, props])
    setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast, index) => (
          <div
            key={index}
            className="px-4 py-3 bg-card border rounded-lg shadow-lg text-sm"
          >
            {toast.title && <p className="font-medium">{toast.title}</p>}
            {toast.description && (
              <p className="text-muted-foreground">{toast.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a Toaster')
  }
  return context
}
