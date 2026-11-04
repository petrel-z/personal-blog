import type { Permission } from '../permissions'

export type BuiltinRoleName = 'admin' | 'editor' | 'reviewer' | 'member'

export interface RoleDefinition {
  label: string
  description: string
  defaultPermissions: readonly Permission[]
}

export interface RoleSummary {
  id: string
  name: BuiltinRoleName
  description: string | null
  memberCount: number
  permissions: Permission[]
}
