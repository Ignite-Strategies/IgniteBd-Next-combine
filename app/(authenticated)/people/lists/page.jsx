'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// This page redirects to the list manager
export default function ListsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  useEffect(() => {
    const qs = companyHQId ? `?companyHQId=${encodeURIComponent(companyHQId)}` : '';
    router.replace(`/contacts/list-manager${qs}`);
  }, [router, companyHQId]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
        <div className="text-gray-600">Redirecting to lists</div>
      </div>
    </div>
  );
}






