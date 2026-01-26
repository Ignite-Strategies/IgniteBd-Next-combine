'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';

export default function AssociatePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Link to Business"
          subtitle="Associate contacts with companies"
          backTo="/people/manage"
          backLabel="Back to Manage"
        />

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Link Contacts to Businesses
            </h2>
            <p className="mb-6 text-gray-600">
              This feature allows you to associate contacts with companies. 
              Business associations are typically created automatically during enrichment.
            </p>
            <p className="mb-6 text-sm text-gray-500">
              For MVP1, business associations are handled implicitly through enrichment flows.
            </p>
            <button
              type="button"
              onClick={() => router.push('/people/manage')}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}






