import { NextResponse } from 'next/server';

/**
 * Middleware to handle bills subdomain routing
 * Ensures bills.ignitegrowth.biz/company-slug/bill-id routes correctly
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Only handle bills subdomain
  if (host.includes('bills.ignitegrowth.biz')) {
    // Log for debugging
    console.log(`🔍 Bills subdomain request: ${pathname} (host: ${host})`);
    
    // Path should be /company-slug/bill-id (two segments)
    const pathSegments = pathname.split('/').filter(Boolean);
    
    // Allow bill routes to pass through to app/(public)/[companySlug]/[part]/page.jsx
    if (pathSegments.length === 2 && !pathname.startsWith('/api/')) {
      console.log(`✅ Allowing bill route: ${pathname}`);
      return NextResponse.next();
    }
    
    // Block other routes on bills subdomain (except API)
    if (pathname !== '/' && !pathname.startsWith('/api/')) {
      console.log(`❌ Blocking non-bill route on bills subdomain: ${pathname}`);
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
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
