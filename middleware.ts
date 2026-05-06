import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/api/proxy'];
  
  // Protected routes
  const protectedRoutes = ['/home', '/devices', '/data', '/processing', '/training', '/chatbot', '/settings'];
  
  // Role-specific routes
  const adminRoutes = ['/admin'];
  const orgRoutes = ['/members', '/labs'];
  
  // Check if accessing a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  const isOrgRoute = orgRoutes.some(route => pathname.startsWith(route));
  
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
  
  // Skip middleware for protected routes - let client-side auth handle it
  // since we use localStorage for token storage
  if (isProtectedRoute || isAdminRoute || isOrgRoute) {
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
