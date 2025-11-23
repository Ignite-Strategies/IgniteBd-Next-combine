'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileText, Presentation, ArrowRight } from 'lucide-react';

export default function ContentHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Content Studio"
          subtitle="Draft articles, social posts, and assets that accelerate demand."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Content Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Presentations */}
          <div
            onClick={() => router.push('/content/presentations')}
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-red-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-red-100 p-3">
                <Presentation className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Presentations</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Draft, refine, and publish presentations for CLEs, webinars, and conferences.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Blog Posts - Coming Soon */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg opacity-60">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-gray-100 p-3">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Blog Posts</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Create and manage blog content for your website.
            </p>
            <div className="text-xs text-gray-500 font-medium">Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
