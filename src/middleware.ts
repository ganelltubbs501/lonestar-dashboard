import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import logger from '@/lib/logger';

// Configure which routes require authentication
const protectedRoutes = [
  '/board',
  '/calendar',
  '/events',
  '/inbox',
  '/admin',
  '/trigger',
  '/texas-authors',
];

const adminRoutes = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (auth pages, static assets, API)
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check if route needs authentication
  const needsAuth = protectedRoutes.some((route) => pathname.startsWith(route));

  if (needsAuth) {
    // Get session
    const session = await auth();

    // Block unauthenticated access
    if (!session || !session.user) {
      logger.warn({ pathname, userId: null }, 'Unauthenticated access attempt');
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Check admin routes
    const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
    if (isAdminRoute && session.user.role !== 'ADMIN') {
      logger.warn(
        { pathname, userId: session.user.id, role: session.user.role },
        'Unauthorized admin access attempt'
      );
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Authenticated and authorized - continue
    const response = NextResponse.next();
    
    // Add user info to response headers for logging
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-role', session.user.role);

    return response;
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Protect all app routes
    '/board/:path*',
    '/calendar/:path*',
    '/events/:path*',
    '/inbox/:path*',
    '/admin/:path*',
    '/trigger/:path*',
    '/texas-authors/:path*',
  ],
};
