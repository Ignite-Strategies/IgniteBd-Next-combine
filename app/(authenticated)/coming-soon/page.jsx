'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-flex items-center gap-1 transition-colors"
          >
            ← Go Back
          </button>
          <h1 className="text-4xl font-bold mb-2">Coming Soon</h1>
          <p className="text-gray-600 text-lg">This feature is currently in development.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-gray-100 p-6">
              <Clock className="h-12 w-12 text-gray-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-600 mb-8">
            This feature is currently in development and will be available soon.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

