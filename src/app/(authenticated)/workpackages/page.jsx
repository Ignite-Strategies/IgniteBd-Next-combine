'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Work Packages Landing Page
 * Redirects to the create page (4-option chooser)
 */
export default function WorkPackagesPage() {
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
