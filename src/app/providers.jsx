'use client';

import { ActivationProvider } from '@/context/ActivationContext.jsx';
import AppShell from '@/components/AppShell.jsx';

export default function Providers({ children }) {
  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}

