'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function ContentHubPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Content Studio"
          subtitle="Draft articles, social posts, and assets that accelerate demand."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Content workflows are on deck</p>
          <p className="mt-2 text-sm text-gray-500">
            The Next.js app now routes correctly. The detailed planner from the React app will be
            migrated in the next milestone.
          </p>
        </div>
      </div>
    </div>
  );
}
