'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Settings, Calendar, List } from 'lucide-react';

export default function EventsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Event Intelligence Planner"
          subtitle="Discover and evaluate events that align with your business development goals"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Super Fork - Four Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* 1. Research Events by Persona */}
          <div
            onClick={() => router.push('/events/build-from-persona')}
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-100 p-3">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Research Events by Persona</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Generate personalized event recommendations
            </p>
            <p className="text-sm text-gray-600">
              Select a persona and configure filters to generate event recommendations tailored to their needs and interests
            </p>
          </div>

          {/* 2. Set Your Plan */}
          <div
            onClick={() => router.push('/events/set-plan')}
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-purple-100 p-3">
                <Settings className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Set Your Plan</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Create or edit your event program with constraints
            </p>
            <p className="text-sm text-gray-600">
              Define your program constraints (cost, location, travel preferences) and select from matching events. Loads your previous plan if you have one.
            </p>
          </div>

          {/* 3. See Plans */}
          <div
            onClick={() => router.push('/events/plans')}
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-green-100 p-3">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">See Plans</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              View and manage your event plans
            </p>
            <p className="text-sm text-gray-600">
              Browse all your event plans and see the events organized within each plan
            </p>
          </div>

          {/* 4. See Events */}
          <div
            onClick={() => router.push('/events/list')}
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-orange-100 p-3">
                <List className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">See Events</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              View all your selected events
            </p>
            <p className="text-sm text-gray-600">
              See all events you've chosen, whether they're in plans or standalone
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
