'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Navigation from './Navigation';

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
  '/bd-intelligence',
  '/settings',
  '/client-operations',
  '/workpackages',
  '/client-operations/execution',
  '/billing',
  '/templates',
  '/people',
  '/companies',
];


export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      });
    }).catch((err) => {
      console.warn('Failed to initialize Firebase auth:', err);
      setIsAuthenticated(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  // Routes that should never show navigation (even when authenticated)
  const PUBLIC_ROUTES = ['/'];
  const isPublicRoute = pathname && PUBLIC_ROUTES.includes(pathname);

  // Show navigation when authenticated, but not on public routes like splash
  if (isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Global component */}
        <Navigation />
        
        {/* Sidebar - Only render when showSidebar is true */}
        {showSidebar && <Sidebar />}
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
