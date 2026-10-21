import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">没有后台访问权限</h1>
      <p className="text-text-muted">当前账号尚未获得管理权限，请联系博主。</p>
      <Link href="/" className="text-primary hover:underline">返回博客首页</Link>
    </main>
  )
}
