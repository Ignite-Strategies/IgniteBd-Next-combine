'use client';

import { useEffect } from 'react';
import { ActivationProvider } from '@/context/ActivationContext.jsx';
import AppShell from '@/components/AppShell.jsx';

export default function Providers({ children }) {
  // Lazy load Firebase and error handler only in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize Firebase when needed (not at module level)
      import('@/lib/firebase').catch((err) => {
        console.warn('Failed to load Firebase:', err);
      });
      
      // Initialize error handler to filter third-party errors (GoDaddy, etc.)
      import('@/lib/errorHandler').catch((err) => {
        console.warn('Failed to load error handler:', err);
      });
    }
  }, []);

  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}

