import { PERMISSIONS } from './permissions'
import type { BuiltinRoleName, RoleDefinition } from './types/authorization'

// Defaults apply only when a role is first created; later business grants come from the database.
export const ROLE_DEFINITIONS = {
  admin: {
    label: '管理员',
    description: '拥有全部后台权限，负责用户、角色与系统管理',
    defaultPermissions: PERMISSIONS,
  },
  editor: {
    label: '编辑者',
    description: '默认可管理自己的文章和上传文件，业务权限由管理员配置',
    defaultPermissions: ['dashboard:view', 'post:read', 'post:create', 'post:update', 'post:delete', 'upload:create'],
  },
  reviewer: {
    label: '审核者',
    description: '默认可查看和审核评论，业务权限由管理员配置',
    defaultPermissions: ['dashboard:view', 'comment:read', 'comment:approve', 'comment:reject'],
  },
  member: {
    label: '普通会员',
    description: '公开注册的默认角色，不提供后台权限',
    defaultPermissions: [],
  },
} as const satisfies Record<BuiltinRoleName, RoleDefinition>
