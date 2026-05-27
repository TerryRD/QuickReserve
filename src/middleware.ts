import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/callback', '/api/health']
const AUTH_PATHS = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Bypass static & assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)
  ) {
    return response
  }

  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p))
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Already logged in users hitting login/signup → redirect to root (resolver picks dashboard)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Anonymous user hitting a protected route → login
  const isProtected =
    pathname.startsWith('/platform') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/packages') ||
    pathname.startsWith('/my-bookings') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/invite')

  if (!user && isProtected && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image).*)'],
}
