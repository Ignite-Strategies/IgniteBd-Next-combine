'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Insights"
          subtitle="Surface trends across growth, pipeline, and relationships."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Insights visualization coming soon</p>
          <p className="mt-2 text-sm text-gray-500">
            Charts and metrics from the React dashboard will be reintroduced here after the data layer
            migration. Route now resolves without a 404.
          </p>
        </div>
      </div>
    </div>
  );
}
