'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ContactSelectRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  useEffect(() => {
    // IMMEDIATE redirect - no delay
    const url = companyHQId 
      ? `/personas/build-from-contact?companyHQId=${companyHQId}`
      : '/personas/build-from-contact';
    // Use replace to avoid adding to history
    router.replace(url);
  }, [router, companyHQId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to new page...</p>
      </div>
    </div>
  );
}

export default function ContactSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <ContactSelectRedirect />
    </Suspense>
  );
}

