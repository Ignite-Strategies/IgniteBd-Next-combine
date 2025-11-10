'use client';

import PageHeader from '@/components/PageHeader.jsx';

export default function BrandingHubPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Branding Hub"
          subtitle="Manage voice, visual identity, and experience checkpoints."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Brand system builder coming soon</p>
          <p className="mt-2 text-sm text-gray-500">
            This stub ensures the App Router path resolves. The live brand toolkit and identity pulse
            widgets will be migrated next.
          </p>
        </div>
      </div>
    </div>
  );
}
