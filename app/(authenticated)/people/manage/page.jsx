'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ManageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  useEffect(() => {
    const qs = companyHQId ? `?companyHQId=${encodeURIComponent(companyHQId)}` : '';
    router.replace(`/contacts/view${qs}`);
  }, [router, companyHQId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to contacts...</p>
      </div>
    </div>
  );
}

/**
 * Manage page redirects to contacts view.
 * Suspense required for useSearchParams() during static generation.
 */
export default function ManagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center"><p className="text-gray-600">Redirecting to contacts...</p></div>
      </div>
    }>
      <ManageRedirect />
    </Suspense>
  );
}

