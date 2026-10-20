jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('next-auth/react', () => ({ SessionProvider: 'div', useSession: jest.fn(), signOut: jest.fn(), signIn: jest.fn() }))
// Inspect the server access boundary without mounting the interactive shell.
jest.mock('react', () => ({ ...jest.requireActual('react'), useState: (value: unknown) => [value, () => {}] }))
jest.mock('@/server/db', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  usePathname: () => '/admin/dashboard',
}))

import { auth } from '@/auth'
import { prisma } from '@/server/db'
import AdminLayout from '@/app/(admin)/layout'

beforeEach(() => jest.resetAllMocks())

test('the server refuses to render admin content for visitors', async () => {
  ;(auth as jest.Mock).mockResolvedValue(null)
  const { redirect } = require('next/navigation')
  redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) })
  await expect(Promise.resolve().then(() => AdminLayout({ children: 'protected content' }))).rejects.toThrow('REDIRECT:/login')
})

test('members are sent to the access-denied page without rendering admin content', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'member' } })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'member', deletedAt: null, userRoles: [] })
  const { redirect } = require('next/navigation')
  redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) })
  await expect(Promise.resolve().then(() => AdminLayout({ children: 'protected content' }))).rejects.toThrow('REDIRECT:/forbidden')
})
