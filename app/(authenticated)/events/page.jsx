'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Calendar, Sparkles, ArrowRight } from 'lucide-react';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Event Intelligence Planner"
          subtitle="Discover and evaluate events that align with your business development goals"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="space-y-6">
          {/* Primary Action Card */}
          <div
            onClick={() => router.push('/events/build-from-persona')}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-gray-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Build from Persona</h3>
                <p className="text-gray-600 mb-4">
                  Generate personalized event recommendations based on your target persona and business development priorities.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder Cards (Disabled) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 opacity-60">
              <div className="flex items-start gap-3">
                <Calendar className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">Browse Events</h3>
                  <p className="text-sm text-gray-500">Coming soon: Browse curated event database</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 opacity-60">
              <div className="flex items-start gap-3">
                <Calendar className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">Saved Events</h3>
                  <p className="text-sm text-gray-500">Coming soon: View your saved event recommendations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
