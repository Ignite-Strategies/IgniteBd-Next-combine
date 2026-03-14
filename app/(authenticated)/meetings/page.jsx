'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, User, ArrowRight, AlertCircle, RefreshCw, Sparkles, Search, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import LogMeetingModal from '@/components/meetings/LogMeetingModal';
import api from '@/lib/api';

/**
 * Meetings Page
 * 
 * Features:
 * - Meeting Prep (generate BD Intel prep for a contact)
 * - Upcoming Meetings (coming soon)
 */
export default function MeetingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contactName, setContactName] = useState('');
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');
  const [showLogMeeting, setShowLogMeeting] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState('all'); // 'all', 'upcoming', 'past'
  const [preSelectedContact, setPreSelectedContact] = useState(null);
  
  const contactIdFromQuery = searchParams?.get('contactId');
  const companyHQIdFromQuery = searchParams?.get('companyHQId');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      companyHQIdFromQuery ||
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
    
    // If contactId is in query params, fetch contact and open log meeting modal
    if (contactIdFromQuery) {
      api.get(`/api/contacts/${contactIdFromQuery}`)
        .then((res) => {
          if (res.data?.success && res.data?.contact) {
            setPreSelectedContact(res.data.contact);
            setShowLogMeeting(true);
          }
        })
        .catch((err) => {
          console.error('Error loading contact:', err);
        });
    }
  }, [companyHQIdFromQuery, contactIdFromQuery]);

  const loadMeetings = async () => {
    if (!companyHQId) return;
    setLoadingMeetings(true);
    try {
      let url = `/api/meetings?crmId=${companyHQId}&limit=50`;
      if (contactIdFromQuery) {
        url += `&contactId=${contactIdFromQuery}`;
      }
      const res = await api.get(url);
      if (res.data?.success && res.data?.meetings) {
        setMeetings(res.data.meetings);
      } else {
        setMeetings([]);
      }
    } catch (err) {
      console.error('Error loading meetings:', err);
      setMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  };

  useEffect(() => {
    if (companyHQId) {
      loadMeetings();
    }
  }, [companyHQId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const now = new Date();
  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.meetingDate) >= now
  );
  const pastMeetings = meetings.filter((m) => new Date(m.meetingDate) < now);

  const displayedMeetings =
    meetingFilter === 'upcoming'
      ? upcomingMeetings
      : meetingFilter === 'past'
      ? pastMeetings
      : meetings;

  const handleMeetingPrep = async () => {
    if (!contactName.trim()) {
      setError('Please enter a contact name');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setSearching(true);
    setError('');

    try {
      // Search for contact by name
      const params = new URLSearchParams({ companyHQId });
      const contactsResponse = await api.get(`/api/contacts?${params.toString()}`);

      if (!contactsResponse.data?.success || !contactsResponse.data?.contacts) {
        throw new Error('Failed to fetch contacts');
      }

      const contacts = contactsResponse.data.contacts;
      
      // Find contact by name (case-insensitive partial match)
      const searchName = contactName.toLowerCase().trim();
      const matchedContact = contacts.find(contact => {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().trim();
        const email = (contact.email || '').toLowerCase();
        return fullName.includes(searchName) || 
               email.includes(searchName) ||
               (contact.fullName || '').toLowerCase().includes(searchName);
      });

      if (!matchedContact) {
        setError(`Contact "${contactName}" not found. Make sure the contact exists in your CRM.`);
        setSearching(false);
        return;
      }

      // Found contact - generate prep
      setSearching(false);
      setGenerating(true);

      // Generate analysis
      const analysisResponse = await api.post(`/api/contacts/${matchedContact.id}/analysis`, {
        companyHQId,
      });

      if (analysisResponse.data?.success) {
        // Navigate to prep page
        router.push(`/contacts/${matchedContact.id}/prep`);
      } else {
        throw new Error(analysisResponse.data?.error || 'Failed to generate prep');
      }
    } catch (err) {
      console.error('Error generating meeting prep:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate meeting prep');
    } finally {
      setSearching(false);
      setGenerating(false);
    }
  };

  return (
    <div className="bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Meetings"
          subtitle="Prep, schedule, and follow up on the conversations that move deals."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
          actions={
            <button
              onClick={() => setShowLogMeeting(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Log Meeting
            </button>
          }
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Meeting Prep Section */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Meeting Prep
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Generate BD Intel prep for a contact meeting
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !searching && !generating) {
                    handleMeetingPrep();
                  }
                }}
                placeholder="Enter contact name or email..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={searching || generating}
              />
            </div>
            <button
              onClick={handleMeetingPrep}
              disabled={searching || generating || !contactName.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : searching ? (
                <>
                  <Search className="h-4 w-4 animate-pulse" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Prep
                </>
              )}
            </button>
          </div>
        </div>

        {/* Meetings List Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Meetings
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {upcomingMeetings.length} upcoming, {pastMeetings.length} past
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMeetingFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  meetingFilter === 'all'
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMeetingFilter('upcoming')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  meetingFilter === 'upcoming'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Upcoming ({upcomingMeetings.length})
              </button>
              <button
                onClick={() => setMeetingFilter('past')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  meetingFilter === 'past'
                    ? 'bg-gray-100 text-gray-800 border border-gray-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Past ({pastMeetings.length})
              </button>
            </div>
          </div>

          {loadingMeetings ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading meetings...</span>
            </div>
          ) : displayedMeetings.length > 0 ? (
            <div className="space-y-3">
              {displayedMeetings.map((meeting) => {
                const meetingDate = new Date(meeting.meetingDate);
                const isUpcoming = meetingDate >= now;
                const outcomeColors = {
                  POSITIVE: 'bg-green-100 text-green-800 border-green-300',
                  NEUTRAL: 'bg-gray-100 text-gray-800 border-gray-300',
                  NEGATIVE: 'bg-red-100 text-red-800 border-red-300',
                  NO_SHOW: 'bg-amber-100 text-amber-800 border-amber-300',
                };
                const typeLabels = {
                  INTRO: 'Intro',
                  FOLLOW_UP: 'Follow-up',
                  PROPOSAL_REVIEW: 'Proposal Review',
                  CHECK_IN: 'Check-in',
                  OTHER: 'Other',
                };
                return (
                  <div
                    key={meeting.id}
                    className={`rounded-lg border p-4 transition hover:shadow-sm ${
                      isUpcoming
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatDate(meeting.meetingDate)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            {typeLabels[meeting.meetingType] || meeting.meetingType}
                          </span>
                          {meeting.outcome && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                outcomeColors[meeting.outcome] ||
                                'bg-gray-100 text-gray-800 border-gray-300'
                              }`}
                            >
                              {meeting.outcome}
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {meeting.contact?.name || 'Unknown Contact'}
                          </span>
                          {meeting.contact?.companyName && (
                            <span className="text-xs text-gray-500">
                              · {meeting.contact.companyName}
                            </span>
                          )}
                        </div>
                        {meeting.summary && (
                          <p className="text-sm text-gray-700 mb-2 italic">{meeting.summary}</p>
                        )}
                        {meeting.notes && (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-2">
                            {meeting.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                          {meeting.nextAction && (
                            <span>
                              <span className="font-medium">Next:</span> {meeting.nextAction}
                            </span>
                          )}
                          {meeting.nextEngagementDate && (
                            <span>
                              <span className="font-medium">Follow-up:</span>{' '}
                              {formatDate(meeting.nextEngagementDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/contacts/${meeting.contactId}`)}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        View Contact
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {meetingFilter === 'upcoming'
                  ? 'No upcoming meetings'
                  : meetingFilter === 'past'
                  ? 'No past meetings'
                  : 'No meetings logged yet'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {meetingFilter === 'all'
                  ? 'Click "Log Meeting" to record your first meeting.'
                  : 'Try changing the filter or log a new meeting.'}
              </p>
              <button
                onClick={() => setShowLogMeeting(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition"
              >
                <Plus className="h-4 w-4" />
                Log Meeting
              </button>
            </div>
          )}
        </div>
      </div>

      <LogMeetingModal
        isOpen={showLogMeeting}
        onClose={() => {
          setShowLogMeeting(false);
          setPreSelectedContact(null);
          // Clear query params if they were set
          if (contactIdFromQuery || companyHQIdFromQuery) {
            router.push('/meetings');
          }
        }}
        companyHQId={companyHQId}
        preSelectedContact={preSelectedContact}
        onSaved={() => {
          setShowLogMeeting(false);
          setPreSelectedContact(null);
          loadMeetings(); // Refresh meetings list after logging
          // Clear query params if they were set
          if (contactIdFromQuery || companyHQIdFromQuery) {
            router.push('/meetings');
          }
        }}
      />
    </div>
  );
}
