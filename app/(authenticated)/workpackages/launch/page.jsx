'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DEPRECATED: Redirect to new create flow
 * This route is deprecated - redirects to /workpackages/create
 */
export default function DeprecatedLaunchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workpackages/create');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
      <p className="text-gray-600">Redirecting...</p>
    </div>
  );
}
