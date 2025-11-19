'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

/**
 * Deprecated: Create Deliverables
 * Redirects to new unified execution surface
 */
export default function OldCreateDeliverablesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/client-operations/execution');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader className="h-6 w-6 animate-spin text-gray-400" />
      <span className="ml-2 text-sm text-gray-500">Redirecting...</span>
    </div>
  );
}
