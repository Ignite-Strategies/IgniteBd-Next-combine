'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';

export default function GoogleImportPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Import from Google"
          subtitle="Import contacts from Google Workspace"
          backTo="/people/load"
          backLabel="Back to Load Up"
        />

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Coming Soon
            </h2>
            <p className="mb-6 text-gray-600">
              Google Workspace import is currently under development. This will work similarly to the Microsoft Outlook import, allowing you to extract and import contacts from your Google Workspace account.
            </p>
            <button
              type="button"
              onClick={() => router.push('/people/load')}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Load Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



