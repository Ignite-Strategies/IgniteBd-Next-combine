'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function FromContactRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const contactId = searchParams?.get('contactId') || '';

  useEffect(() => {
    // Redirect to new build-from-contact page
    let url = '/personas/build-from-contact';
    const params = new URLSearchParams();
    if (companyHQId) params.set('companyHQId', companyHQId);
    if (contactId) params.set('contactId', contactId);
    if (params.toString()) url += `?${params.toString()}`;
    
    router.replace(url);
  }, [router, companyHQId, contactId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to new page...</p>
      </div>
    </div>
  );
}

export default function FromContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <FromContactRedirect />
    </Suspense>
  );
}

