'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, ArrowRight, AlertCircle, RefreshCw, Sparkles, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
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
  const [contactName, setContactName] = useState('');
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Meetings"
          subtitle="Prep, schedule, and follow up on the conversations that move deals."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
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

        {/* Upcoming Meetings Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Upcoming Meetings
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Your scheduled meetings from Microsoft Calendar
            </p>
          </div>

          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Coming Soon
            </p>
            <p className="text-xs text-gray-500">
              Meeting calendar integration will be available soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
