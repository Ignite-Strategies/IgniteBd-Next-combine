'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Navigation from './Navigation';
import { CompanyHQContextHeader } from './CompanyHQContextHeader';

const ROUTES_WITH_SIDEBAR = [
  '/growth-dashboard',
  '/people',
  '/personas',
  '/persona',
  '/products',
  '/product',
  '/outreach',
  '/pipelines',
  '/proposals',
  '/content',
  '/branding-hub',
  '/events',
  '/meetings',
  '/insights',
  '/settings',
  '/client-operations',
  '/workpackages',
  '/client-operations/execution',
  '/billing',
  '/templates',
  '/companies',
  '/contacts', // Contact management routes (includes /contacts/view, /contacts/manual, etc.)
];

function pathHasSidebar(path) {
  if (!path) return false;
  return ROUTES_WITH_SIDEBAR.some((route) => path.startsWith(route));
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // Resolved path: use pathname when available; fallback to window.location.pathname so sidebar shows on /contacts/view when usePathname() is null during hydration
  const [resolvedPath, setResolvedPath] = useState(pathname ?? '');

  useEffect(() => {
    setResolvedPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  }, [pathname]);

  // Lazy load Firebase and check auth state (only in browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let unsubscribe = null;

    // Dynamically import Firebase to avoid loading during build/SSR
    Promise.all([
      import('firebase/auth'),
      import('@/lib/firebase')
    ]).then(([{ onAuthStateChanged }, firebaseModule]) => {
      const auth = firebaseModule.auth;
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsAuthenticated(!!user);
        setAuthChecked(true);
      });
    }).catch((err) => {
      console.warn('Failed to initialize Firebase auth:', err);
      setIsAuthenticated(false);
      setAuthChecked(true);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const showSidebar = useMemo(() => pathHasSidebar(resolvedPath), [resolvedPath]);

  // App routes always get the shell (e.g. /contacts/view). When pathname is null (hydration), use resolvedPath so sidebar still shows.
  const isAppRoute = useMemo(() => pathHasSidebar(resolvedPath) || !resolvedPath, [resolvedPath]);

  // Routes that should never show navigation or context header (even when authenticated)
  const PUBLIC_ROUTES = ['/'];
  // Public bill payment routes - standalone pages, no admin UI
  // Check for both /bill/... and root-level bill routes (for bills subdomain)
  const BILL_ROUTES = ['/bill'];
  const isRootBillRoute = resolvedPath && /^\/[^\/]+\/[^\/]+$/.test(resolvedPath) && resolvedPath.split('/').length === 3;
  // Auth/onboarding/setup routes that shouldn't show context header
  const HIDE_CONTEXT_ROUTES = [
    '/welcome', 
    '/signup', 
    '/signin', 
    '/sign-in', 
    '/sign-up',
    '/company/', // All company setup routes
    '/profilesetup',
    '/owner-identity-survey',
  ];
  const isPublicRoute = resolvedPath && PUBLIC_ROUTES.includes(resolvedPath);
  const isBillRoute = resolvedPath && (BILL_ROUTES.some(route => resolvedPath.startsWith(route)) || isRootBillRoute);
  const shouldHideContext = resolvedPath && HIDE_CONTEXT_ROUTES.some(route => resolvedPath.startsWith(route));

  // Show shell when: not public/bill, and (auth not checked yet, or authenticated, or on an app route).
  // isAppRoute is true when pathname is null (hydration) so we don't flash no-shell.
  const shouldShowShell = !isPublicRoute && !isBillRoute && (!authChecked || isAuthenticated || isAppRoute);
  
  if (shouldShowShell) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Global component */}
        <Navigation />
        
        {/* CompanyHQ Context Header - Shows current company and role (hidden on auth/onboarding pages) */}
        {!shouldHideContext && <CompanyHQContextHeader />}
        
        {/* Sidebar - Only render when showSidebar is true */}
        {showSidebar && (
          <Suspense fallback={<div className="w-64" />}>
            <Sidebar />
          </Suspense>
        )}
        {/* Main Content Area */}
        <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
          {children}
        </main>
      </div>
    );
  }

  // For unauthenticated routes or public routes (like splash), render children without navigation
  return <>{children}</>;
}
