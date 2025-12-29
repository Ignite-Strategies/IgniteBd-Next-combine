'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

/**
 * Meetings Page
 * 
 * Features:
 * - Set Meeting Times (schedule meetings with contacts)
 * - Upcoming Meetings (list of scheduled meetings)
 * - Prep Button (generate/display Contact Analysis for meeting prep)
 */
export default function MeetingsPage() {
  const router = useRouter();
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // TODO: Load upcoming meetings from API
    // For now, using placeholder data
    setUpcomingMeetings([]);
  }, []);

  const handlePrep = (contactId) => {
    // Navigate to contact analysis/prep page
    router.push(`/contacts/${contactId}/prep`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Meetings"
          subtitle="Prep, schedule, and follow up on the conversations that move deals."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Set Meeting Times Section */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Set Meeting Times
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Schedule meetings with your contacts
              </p>
            </div>
            <button
              onClick={() => {
                // TODO: Open meeting scheduling modal/page
                alert('Meeting scheduler coming soon');
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Schedule Meeting
            </button>
          </div>

          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Meeting scheduler coming soon
            </p>
            <p className="text-xs text-gray-500">
              You'll be able to schedule meetings directly with contacts here
            </p>
          </div>
        </div>

        {/* Upcoming Meetings Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                Upcoming Meetings
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Your scheduled meetings and prep materials
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">Loading meetings...</span>
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm font-semibold text-gray-700 mb-2">
                No upcoming meetings
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Schedule a meeting to see it here
              </p>
              <button
                onClick={() => {
                  alert('Meeting scheduler coming soon');
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Schedule Your First Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {meeting.contactName || 'Meeting'}
                        </h3>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {meeting.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {meeting.time}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrep(meeting.contactId)}
                      className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Prep
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
