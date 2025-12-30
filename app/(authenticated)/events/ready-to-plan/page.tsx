'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';

function ReadyToPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tunerId = searchParams.get('tunerId');
  const companyHQId = searchParams.get('companyHQId') || '';

  const handleContinue = () => {
    if (tunerId) {
      // Redirect to search/pick page with companyHQId if available
      const url = companyHQId 
        ? `/events/search-pick/${tunerId}?companyHQId=${companyHQId}`
        : `/events/search-pick/${tunerId}`;
      router.push(url);
    } else {
      // Redirect to preferences with companyHQId if available
      const url = companyHQId 
        ? `/events/preferences?companyHQId=${companyHQId}`
        : '/events/preferences';
      router.push(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Ready to Plan"
          subtitle="Your preferences are saved. Now let's find events that match."
          backTo="/events/preferences"
          backLabel="Back to Preferences"
        />

        <div className="mt-8">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Preferences Saved</h3>
              <p className="text-gray-600 mb-6">
                Your preferences have been saved. We'll use AI to find events that match your criteria. 
                Even if you requested fewer events per quarter, we'll show you multiple options so you can choose the best ones.
              </p>
              <button
                onClick={handleContinue}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Find Events →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReadyToPlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ReadyToPlanContent />
    </Suspense>
  );
}
