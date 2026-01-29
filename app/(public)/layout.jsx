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

  // Check if this is the tutorial route (has its own header)
  const isTutorialRoute = pathname && pathname.startsWith('/tutorial');

  // Bill routes and tutorial: NO AppShell, NO Providers, just pure content
  if (isBillRoute || isTutorialRoute) {
    return <>{children}</>;
  }

  // Other public routes: Use AppShell
  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}
