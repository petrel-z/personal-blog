import { redirect } from 'next/navigation'
import { AccessError, requireAdminPermission } from '@/server/auth/access'
import RoleManager from './_components/RoleManager'

export default async function RolesPage() {
  try {
    await requireAdminPermission('role:read')
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? '/login' : '/forbidden')
    throw error
  }
  return <RoleManager />
}
