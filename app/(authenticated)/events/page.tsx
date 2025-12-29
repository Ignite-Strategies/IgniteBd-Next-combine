'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Calendar, List } from 'lucide-react';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Event Intelligence Planner"
          subtitle="Discover and evaluate events that align with your business development goals"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Main Content - Find and Select Events (Large) + Sidebar (Small) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main - Find and Select Events (2 columns) */}
          <div
            onClick={() => router.push('/events/preferences')}
            className="lg:col-span-2 cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-lg hover:shadow-xl transition-all hover:border-red-300"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Find and Select Events</h2>
                <p className="text-lg text-gray-600 mb-4">
                  Set your preferences, get AI-powered event recommendations, and build your event program. The main UX for finding and selecting events that match your criteria.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-semibold text-lg">
                  <span>Get Started</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Research by Persona (1 column) */}
          <div className="lg:col-span-1 space-y-4">
            {/* My Plan */}
            <div
              onClick={() => router.push('/events/preferences')}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:border-gray-300"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">My Plan</h3>
              </div>
              <p className="text-sm text-gray-600">
                Set preferences and build your event program
              </p>
            </div>

            {/* My Events */}
            <div
              onClick={() => router.push('/events/list')}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:border-gray-300"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-orange-100 p-2">
                  <List className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">My Events</h3>
              </div>
              <p className="text-sm text-gray-600">
                View all your selected events
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
