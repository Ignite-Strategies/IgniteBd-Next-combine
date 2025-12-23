'use client';

import { useMemo, useEffect } from 'react';
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

  // Debug: Log sidebar state (always log for debugging)
  useEffect(() => {
    console.log('AppShell Debug:', {
      pathname,
      showSidebar,
      isCRMRoute,
      showNavigation,
      matchingRoute: pathname ? ROUTES_WITH_SIDEBAR.find(route => pathname.startsWith(route)) : null,
    });
  }, [pathname, showSidebar, isCRMRoute, showNavigation]);

  // If we should show navigation, always include it
  if (showNavigation) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Always visible on authenticated pages */}
        <Navigation />
        
        {/* Sidebar - Always render when showSidebar is true, independent of page loading state */}
        {showSidebar && (isCRMRoute ? <CRMSidebar /> : <Sidebar />)}
        {/* Main Content Area */}
        <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
          {children}
        </main>
      </div>
    );
  }

  // For non-authenticated routes, render children without navigation
  return <>{children}</>;
}
