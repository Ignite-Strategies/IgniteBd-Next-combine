'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileText, ArrowRight } from 'lucide-react';

// Auto-hydrated placeholder sections
const defaultSections = [
  'Introduction',
  'Problem',
  'Insights',
  'Proof Points',
  'Case Study',
  'CTA / Next Steps',
];

export default function PresentationsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Presentations"
          subtitle="Draft, refine, and publish presentations for CLEs, webinars, and conferences."
          backTo="/content"
          backLabel="Back to Content Studio"
        />

        {/* Auto-hydrated Preview Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-3">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Untitled Presentation</h2>
                <p className="text-sm text-gray-500 mt-1">Auto-hydrated draft structure</p>
              </div>
            </div>
          </div>

          {/* Placeholder Sections */}
          <div className="space-y-4">
            {defaultSections.map((section, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{section}</h3>
                  <p className="text-sm text-gray-500 mt-1">Content placeholder</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/content/presentations/build')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
          >
            Build Presentation
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

