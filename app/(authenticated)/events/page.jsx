'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Filter, ArrowRight } from 'lucide-react';

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Path 1: Persona-Based Event Search */}
          <div
            onClick={() => router.push('/events/build-from-persona')}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-gray-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Persona-Based Event Search</h3>
                <p className="text-gray-600 mb-4">
                  Uses AI-driven intelligence to discover events that match your target persona. Results are summarized for your selection.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Path 2: User Preference Event Builder */}
          <div
            onClick={() => router.push('/events/build-from-preferences')}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-gray-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Filter className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">User Preference Event Builder</h3>
                <p className="text-gray-600 mb-4">
                  Filter events by type, date range, geography, and cost. Build your event list directly without AI scoring.
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
