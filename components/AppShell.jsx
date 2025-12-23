'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import CRMSidebar from './CRMSidebar';
import Navigation from './Navigation';

const ROUTES_WITH_SIDEBAR = [
  '/growth-dashboard',
  '/contacts',
  '/personas',
  '/persona',
  '/products',
  '/product',
  '/outreach',
  '/pipelines',
  '/proposals',
  '/ads',
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
  '/crmdashboard',
  '/people',
  '/companies',
];

// CRM-only routes that use CRMSidebar instead of full Sidebar
const CRM_ROUTES = [
  '/crmdashboard',
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
    // Show navigation on all routes EXCEPT public routes
    // This ensures all authenticated pages have navigation
    return !PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  }, [pathname]);

  // If we should show navigation, always include it
  if (showNavigation) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Always visible on authenticated pages */}
        <Navigation />
        
        {/* Sidebar + Content Layout */}
        {showSidebar ? (
          <div className="flex min-h-[calc(100vh-3.5rem)]">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block">
              {isCRMRoute ? <CRMSidebar /> : <Sidebar />}
            </aside>
            {/* Main Content Area */}
            <main className="flex-1 md:ml-64">
              {children}
            </main>
          </div>
        ) : (
          /* Content without sidebar */
          <div className="min-h-[calc(100vh-3.5rem)]">
            {children}
          </div>
        )}
      </div>
    );
  }

  // For non-authenticated routes, render children without navigation
  return <>{children}</>;
}
