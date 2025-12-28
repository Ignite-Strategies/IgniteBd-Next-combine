'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Sparkles, Settings, UserCircle, FileText } from 'lucide-react';

export default function EventsBuildPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build Events"
          subtitle="Choose how you want to start building your event program"
          backTo="/events"
          backLabel="Back to Events"
        />

        {/* Three Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Build from Persona */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => router.push('/events/build-from-persona')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <UserCircle className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Persona</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Generate personalized event recommendations based on your target persona
            </p>
            <p className="text-sm text-gray-600">
              Select a persona and configure filters to generate event recommendations tailored to their needs and interests
            </p>
          </div>

          {/* Build from Event Tuner */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow" 
            onClick={() => router.push('/events/build/tuner')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Event Tuner</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Create an event program with your constraints and preferences
            </p>
            <p className="text-sm text-gray-600">
              Define your program constraints (cost, location, travel preferences) and select from matching events
            </p>
          </div>

          {/* Build from Preferences */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow" 
            onClick={() => router.push('/events/build-from-preferences')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-green-100 p-2">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Preferences</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Manually create an event with your preferences
            </p>
            <p className="text-sm text-gray-600">
              Create a new event from scratch with your custom details and preferences
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

