'use client';

import { useEffect } from 'react';
import { ActivationProvider } from '@/context/ActivationContext.jsx';

export default function Providers({ children }) {
  // Lazy load Firebase and error handler only in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/firebase').catch((err) => {
        console.warn('Failed to load Firebase:', err);
      });
      import('@/lib/errorHandler').catch((err) => {
        console.warn('Failed to load error handler:', err);
      });
    }
  }, []);

  return (
    <ActivationProvider>
      {children}
    </ActivationProvider>
  );
}

