import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/access'
import AdminShell from './_components/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor) redirect('/login')
  if (actor.permissions.length === 0) redirect('/forbidden')
  return <AdminShell permissions={actor.permissions}>{children}</AdminShell>
}
