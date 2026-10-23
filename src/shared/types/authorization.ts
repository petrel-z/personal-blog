import type { Permission } from '../permissions'

export type BuiltinRoleName = 'admin' | 'editor' | 'reviewer' | 'member'

export interface RoleDefinition {
  label: string
  description: string
  defaultPermissions: readonly Permission[]
}
