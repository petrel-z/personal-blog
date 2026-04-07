import { NextRequest, NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-middleware-test', 'running')
  console.log('Simple middleware running, path:', req.nextUrl.pathname)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
