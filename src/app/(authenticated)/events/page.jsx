'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Events & Activations"
          subtitle="Plan, track, and promote upcoming events to keep momentum high."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Event planner coming soon</p>
          <p className="mt-2 text-sm text-gray-500">
            Add events to your calendar, assign owners, and coordinate pre/post outreach campaigns.
            Legacy data from the React app will be ported in the next sprint.
          </p>
        </div>
      </div>
    </div>
  );
}
