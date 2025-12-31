'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, ArrowRight, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

/**
 * Meetings Page
 * 
 * Features:
 * - See My Meetings (from Microsoft Calendar)
 * - Upcoming Meetings (list of scheduled meetings)
 * - Prep Button (generate/display Contact Analysis for meeting prep with BD Intel)
 */
export default function MeetingsPage() {
  const router = useRouter();
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [microsoftConnected, setMicrosoftConnected] = useState(true);
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    loadMeetings();
  }, [companyHQId]);

  const loadMeetings = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ daysAhead: '30' });
      const response = await api.get(`/api/meetings?${params.toString()}`, {
        headers: {
          'x-company-hq-id': companyHQId || '',
        },
      });

      if (response.data?.success) {
        setUpcomingMeetings(response.data.meetings || []);
        setMicrosoftConnected(response.data.connected !== false);
      } else {
        setError(response.data?.error || 'Failed to load meetings');
        setMicrosoftConnected(response.data?.connected !== false);
      }
    } catch (err) {
      console.error('Error loading meetings:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load meetings';
      setError(errorMessage);
      
      // Check if Microsoft is not connected
      if (err.response?.data?.connected === false || errorMessage.includes('not connected')) {
        setMicrosoftConnected(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrep = (contactId) => {
    if (!contactId) {
      alert('This meeting is not linked to a contact. Add the contact to your CRM first.');
      return;
    }
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

        {/* Microsoft Connection Status */}
        {!microsoftConnected && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>
              Connect your Microsoft account to see your meetings. 
              <a href="/settings" className="ml-1 font-semibold underline">Go to Settings</a>
            </span>
          </div>
        )}

        {error && microsoftConnected && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={loadMeetings}
              className="ml-auto flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Upcoming Meetings Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                Upcoming Meetings
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Your scheduled meetings from Microsoft Calendar
              </p>
            </div>
            <button
              onClick={loadMeetings}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
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
                No upcoming meetings found
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {microsoftConnected 
                  ? 'Meetings from your Microsoft Calendar will appear here'
                  : 'Connect your Microsoft account to see your meetings'}
              </p>
              {!microsoftConnected && (
                <a
                  href="/settings"
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Connect Microsoft Account
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {meeting.subject || 'Untitled Meeting'}
                        </h3>
                        {meeting.rawEvent?.webLink && (
                          <a
                            href={meeting.rawEvent.webLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-gray-400 hover:text-blue-600"
                            title="Open in Outlook"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {meeting.contactName && (
                        <p className="text-xs text-gray-600 mb-1">
                          with {meeting.contactName}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {meeting.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {meeting.date}
                          </span>
                        )}
                        {meeting.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {meeting.time}
                          </span>
                        )}
                        {meeting.location && (
                          <span className="text-gray-400">• {meeting.location}</span>
                        )}
                      </div>
                      {meeting.attendees && meeting.attendees.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {meeting.contactId ? (
                      <button
                        onClick={() => handlePrep(meeting.contactId)}
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Prep
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-gray-400">No contact match</span>
                        <button
                          onClick={() => {
                            alert('This meeting is not linked to a contact. Add the contact to your CRM first.');
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Add Contact
                        </button>
                      </div>
                    )}
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
