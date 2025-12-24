'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import CRMSidebar from './CRMSidebar';
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

// CRM-only routes that use CRMSidebar instead of full Sidebar
const CRM_ROUTES = [
  '/people',
  '/people/lists',
  '/outreach',
  '/pipelines',
  '/companies',
  '/personas',
  '/products',
  '/bd-intelligence',
  '/ecosystem',
];

// Public routes that should NOT show navigation
const PUBLIC_ROUTES = [
  '/',
  '/signin',
  '/signup',
  '/splash',
  '/login',
  '/welcome',
  '/company',
  '/profilesetup',
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  const isCRMRoute = useMemo(() => {
    if (!pathname) return false;
    return CRM_ROUTES.some((route) => pathname.startsWith(route));
  }, [pathname]);

  const showNavigation = useMemo(() => {
    if (!pathname) return false;
    // Don't show navigation on public routes (splash, login, welcome, etc.)
    return !PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  }, [pathname]);

  // Show navigation only on authenticated routes
  if (showNavigation) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Only on authenticated pages */}
        <Navigation />
        
        {/* Sidebar - Only render when showSidebar is true */}
        {showSidebar && (isCRMRoute ? <CRMSidebar /> : <Sidebar />)}
        {/* Main Content Area */}
        <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
          {children}
        </main>
      </div>
    );
  }

  // For public routes (splash, login, welcome), render children without navigation
  return <>{children}</>;
}
