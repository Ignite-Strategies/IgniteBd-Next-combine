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

  // ALWAYS show navigation - no guards, no auth checks
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar - Always visible */}
      <Navigation />
      
      {/* Sidebar - Always render when showSidebar is true */}
      {showSidebar && (isCRMRoute ? <CRMSidebar /> : <Sidebar />)}
      {/* Main Content Area */}
      <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
        {children}
      </main>
    </div>
  );
}
