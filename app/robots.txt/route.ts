import { NextResponse } from 'next/server';

/**
 * Dynamic robots.txt route
 * Blocks all crawlers on bills subdomain (private bill pages)
 * Allows crawling on main domain (public pages)
 */
export async function GET(request: Request) {
  const host = request.headers.get('host') || '';
  
  // Check if this is the bills subdomain
  const isBillsSubdomain = host.includes('bills.ignitegrowth.biz');
  
  if (isBillsSubdomain) {
    // Block all crawlers on bills subdomain - bills are private!
    return new NextResponse(
      `User-agent: *
Disallow: /`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  }
  
  // Allow crawling on main domain and other subdomains
  return new NextResponse(
    `User-agent: *
Allow: /`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    }
  );
}
