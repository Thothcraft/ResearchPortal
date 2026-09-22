import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/api/proxy'];
  
  // Protected routes
  const protectedRoutes = ['/home', '/devices', '/captures', '/minutes', '/models', '/processing', '/profile', '/settings', '/labs'];
  const adminRoutes = ['/admin'];
  
  // Check if accessing a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  
  // Allow access to public routes and static assets
  if (publicRoutes.some(route => pathname.startsWith(route)) || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/static') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Allow access to auth page even with token (to allow logout)
  if (pathname === '/auth') {
    return NextResponse.next();
  }
  
  // Allow access to root path
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Protected routes require the HttpOnly session cookie. Bearer-token
  // sessions (legacy localStorage) still work for API calls, but a fresh
  // page load without a cookie redirects to sign-in.
  if (isProtectedRoute) {
    const hasSession = request.cookies.has('thoth_session');
    const hasLegacyAuth = request.cookies.has('auth_token');
    if (!hasSession && !hasLegacyAuth) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
