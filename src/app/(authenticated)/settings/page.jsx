'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Workspace Settings"
          subtitle="Manage company profile, billing, integrations, and preferences."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Settings console coming soon</p>
          <p className="mt-2 text-sm text-gray-500">
            Profile, billing, and integration settings from the legacy app will be migrated into this
            view. Routing is now in place to avoid 404s.
          </p>
        </div>
      </div>
    </div>
  );
}
