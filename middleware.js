import { NextResponse } from 'next/server';

/**
 * Middleware for bills subdomain - minimal, just logs for debugging
 * Route matching is handled by Next.js app router: app/(public)/[companySlug]/[part]/page.jsx
 * Also blocks common security probe patterns
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const userAgent = request.headers.get('user-agent') || '';

  // Block common security probe patterns (attacks looking for exposed files)
  const securityProbePatterns = [
    /^\/\.env/,
    /^\/\.env\.local/,
    /^\/\.env\.production/,
    /^\/\.git/,
    /^\/\.gitignore/,
    /^\/\.gitconfig/,
    /^\/\.htaccess/,
    /^\/\.htpasswd/,
    /^\/wp-admin/,
    /^\/wp-login/,
    /^\/\.well-known\/acme-challenge/,
    /^\/\.DS_Store/,
    /^\/\.idea/,
    /^\/\.vscode/,
    /^\/config\.json/,
    /^\/package\.json/,
    /^\/composer\.json/,
    /^\/\.npmrc/,
    /^\/\.yarnrc/,
  ];

  const isSecurityProbe = securityProbePatterns.some(pattern => pattern.test(pathname));

  if (isSecurityProbe) {
    // Log security probe attempts
    console.log(`🚨 [SECURITY] Blocked probe: ${pathname} (host: ${host}, user-agent: ${userAgent.substring(0, 100)})`);
    
    // Return 404 to not reveal that these files exist or don't exist
    return new NextResponse(null, { status: 404 });
  }

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
