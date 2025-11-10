'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

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
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 lg:ml-64">{children}</div>
    </div>
  );
}
