'use client'

import { useAuth } from './AuthProvider'
import type { Permission } from '@/shared/permissions'

export function PermissionGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth()
  return can(permission) ? children : null
}
