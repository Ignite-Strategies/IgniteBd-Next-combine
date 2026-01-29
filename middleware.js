import { NextResponse } from 'next/server';

/**
 * Middleware for bills subdomain - minimal, just logs for debugging
 * Route matching is handled by Next.js app router: app/(public)/[companySlug]/[part]/page.jsx
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Log bills subdomain requests for debugging
  if (host.includes('bills.ignitegrowth.biz')) {
    console.log(`🔍 [BILLS] ${pathname} (host: ${host})`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
