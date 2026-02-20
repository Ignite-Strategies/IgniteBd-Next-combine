'use client';

import { usePathname } from 'next/navigation';
import { ActivationProvider } from '@/context/ActivationContext.jsx';
import AppShell from '@/components/AppShell.jsx';

/**
 * Public route group layout
 * Bill routes get NO AppShell - completely standalone
 * Other public routes (signin, signup) get AppShell
 */
export default function PublicLayout({ children }) {
  const pathname = usePathname();
  
  // Check if this is a bill route (root-level or /bill/)
  const isBillRoute = pathname && (
    pathname.startsWith('/bill/') ||
    /^\/[^\/]+\/[^\/]+$/.test(pathname) // Matches /company-slug/bill-id pattern
  );

  const isTutorialRoute = pathname && pathname.startsWith('/tutorial');
  const isPlanCheckoutRoute = pathname && pathname.startsWith('/plan-checkout');
  const isRetainerRoute = pathname && (
    pathname.startsWith('/retainer/') ||
    pathname === '/retainer-paid' ||
    pathname === '/retainer-canceled'
  );

  if (isBillRoute || isTutorialRoute || isPlanCheckoutRoute || isRetainerRoute) {
    return <>{children}</>;
  }

  // Other public routes: Use AppShell
  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}
