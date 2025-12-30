'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Calendar, List, RefreshCw } from 'lucide-react';

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const navigateToPreferences = () => {
    if (companyHQId) {
      router.push(`/events/preferences?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/preferences');
    }
  };

  const navigateToBuildFromPersona = () => {
    if (companyHQId) {
      router.push(`/events/build-from-persona?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/build-from-persona');
    }
  };

  const navigateToList = () => {
    if (companyHQId) {
      router.push(`/events/list?companyHQId=${companyHQId}`);
    } else {
      router.push('/events/list');
    }
  };

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
            onClick={navigateToPreferences}
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

          {/* Sidebar - Research by Persona & See Events (1 column) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Research Best Events by Persona */}
            <div
              onClick={navigateToBuildFromPersona}
              className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-blue-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Best Events by Persona</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Get scores and see optimal BD alignment for your goals. Research events with persona-based intelligence.
                  </p>
                  <div className="flex items-center gap-1 text-blue-600 font-medium text-sm">
                    <span>Research Events</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* See Events */}
            <div
              onClick={navigateToList}
              className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all hover:border-orange-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <List className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">See Events</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    View all your selected events
                  </p>
                  <div className="flex items-center gap-1 text-orange-600 font-medium text-sm">
                    <span>View Events</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <EventsPageContent />
    </Suspense>
  );
}
