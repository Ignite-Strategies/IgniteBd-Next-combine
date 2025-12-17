'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function AdsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Ads & SEO"
          subtitle="Track campaign readiness and align paid, organic, and brand messaging."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Ads dashboard under construction</p>
          <p className="mt-2 text-sm text-gray-500">
            Importing creative briefs, keyword plans, and SEO initiatives from the legacy stack. This
            placeholder confirms the App Router route is wired correctly.
          </p>
        </div>
      </div>
    </div>
  );
}
