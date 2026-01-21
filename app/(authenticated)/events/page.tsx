'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  useEffect(() => {
    // One-time redirect to picker page (not in a loop)
    const url = companyHQId 
      ? `/events/picker?companyHQId=${companyHQId}`
      : '/events/picker';
    router.replace(url);
  }, []); // Empty dependency array - only runs once

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center py-8">
          <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <EventsPageContent />
    </Suspense>
  );
}
