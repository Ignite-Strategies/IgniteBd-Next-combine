'use client';

import PageHeader from '@/components/PageHeader.jsx';
import { Calendar } from 'lucide-react';

export default function PipelineRoadmapPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="BD Roadmap"
          subtitle="Plan your 12-month campaign and event calendar"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Empty State */}
        <div className="mt-12 rounded-2xl bg-white p-12 shadow-lg">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Calendar className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Strategic Campaign & Event Timeline
            </h2>
            <p className="mb-6 text-lg text-gray-600">
              The BD Roadmap helps you plan when to launch campaigns, schedule events, and send
              emails throughout the year.
            </p>
            <div className="space-y-4 rounded-xl bg-gray-50 p-6 text-left">
              <h3 className="font-semibold text-gray-900">What you can plan:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Campaign Launches</strong> - "We want to launch the first campaign in
                    January"
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Email Schedules</strong> - Timeline of when nurture emails go out
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Events & Webinars</strong> - 12-month plan for events and conferences
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Strategic Milestones</strong> - "By month 6, we want these events
                    completed"
                  </span>
                </li>
              </ul>
            </div>
            <p className="mt-8 text-sm text-gray-500">
              Timeline view coming soon. For now, manage your campaigns and events through the
              Engage Hub.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
