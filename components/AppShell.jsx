'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
  '/template',
  '/people',
  '/companies',
];


export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  // Show navigation when authenticated
  if (isAuthenticated) {
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

  // For unauthenticated routes, render children without navigation
  return <>{children}</>;
}
