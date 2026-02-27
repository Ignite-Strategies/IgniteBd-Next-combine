'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Manage page redirects to contacts view
 * Contact management (enrichment, editing, etc.) happens on individual contact detail pages
 * This follows the HubSpot pattern where you manage contacts via the contact detail page
 */
export default function ManagePage() {
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

