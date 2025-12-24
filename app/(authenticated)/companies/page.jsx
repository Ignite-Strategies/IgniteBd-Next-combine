'use client';

import { useRouter } from 'next/navigation';
import { Building2, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

export default function CompanyHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="🏢 Company Hub"
          subtitle="Manage prospect and client companies"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Building2 className="h-8 w-8" />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              Company Management
            </h2>
            <p className="mb-6 text-gray-600">
              Company Hub features are being developed. For MVP1, company associations 
              are handled automatically through contact enrichment and management flows.
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Companies are created and linked to contacts automatically when you enrich contacts or import data.
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push('/people')}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Go to People Hub
              </button>
              <button
                type="button"
                onClick={() => router.push('/growth-dashboard')}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

