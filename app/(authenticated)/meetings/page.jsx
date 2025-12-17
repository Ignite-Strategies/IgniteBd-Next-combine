'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function MeetingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Meetings"
          subtitle="Prep, schedule, and follow up on the conversations that move deals."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Meeting command center in progress</p>
          <p className="mt-2 text-sm text-gray-500">
            The original React analytics and prep flows will be ported shortly. This page placeholder
            confirms the route hydrates without errors.
          </p>
        </div>
      </div>
    </div>
  );
}
