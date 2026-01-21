'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Mail, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function CampaignsPage() {
  const router = useRouter();
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);
  const [campaigns, setCampaigns] = useState([]);
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const syncInitiatedRef = useRef(false); // Prevent multiple sync calls

  // Load from localStorage immediately (no blocking)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cached = window.localStorage.getItem('campaigns');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setCampaigns(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Unable to parse cached campaigns', error);
      }
    }
  }, []);

  // Sync from API if owner is hydrated and we haven't synced yet
  // Fix: Memoize with useCallback and remove hydrating from deps to prevent infinite loops
  const syncCampaigns = useCallback(async () => {
    if (!ownerId || syncInitiatedRef.current) return;
    
    syncInitiatedRef.current = true;
    setHydrating(true);
    try {
      // Load campaigns by owner_id (companyHQId is optional filter)
      const response = await api.get('/api/campaigns');
      if (response.data?.success) {
        const data = response.data.campaigns || [];
        setCampaigns(data);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('campaigns', JSON.stringify(data));
        }
        setHydrated(true);
      }
    } catch (error) {
      console.error('Error syncing campaigns:', error);
    } finally {
      setHydrating(false);
    }
  }, [ownerId]);

  // Reset sync ref and hydrated state when ownerId changes (allows sync for new owner)
  useEffect(() => {
    syncInitiatedRef.current = false;
    setHydrated(false);
  }, [ownerId]);

  // Auto-sync when ownerId is available (only once)
  // Fix: Use ref guard to prevent infinite loops
  useEffect(() => {
    if (ownerId && !hydrated && !syncInitiatedRef.current) {
      syncCampaigns();
    }
  }, [ownerId, hydrated, syncCampaigns]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Campaigns"
          subtitle="Manage nurture journeys, one-off sends, and follow-ups."
          backTo="/outreach"
          backLabel="Back to Outreach"
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={syncCampaigns}
                disabled={hydrating}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  hydrating
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <RefreshCw className={hydrating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {hydrating ? 'Syncing...' : 'Sync'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/outreach/campaigns/create')}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Create Campaign
              </button>
            </div>
          }
        />

        {/* Campaigns List */}
        <div className="rounded-2xl bg-white p-6 shadow">
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
              <Mail className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-lg font-semibold text-gray-800">No campaigns yet</p>
              <p className="mt-2 text-sm text-gray-500">
                Launch your first campaign to start building momentum.
              </p>
              <button
                type="button"
                onClick={() => router.push('/outreach/campaigns/create')}
                className="mt-6 flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 mx-auto"
              >
                <Plus className="h-5 w-5" />
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => router.push(`/outreach/campaigns/${campaign.id}/edit`)}
                  className="flex w-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {campaign.type || 'Email Campaign'}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        campaign.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                        campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        campaign.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                        campaign.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status || 'draft'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-gray-900">
                      {campaign.name || 'Untitled Campaign'}
                    </h3>
                    {campaign.description && (
                      <p className="mt-1 text-sm text-gray-600">{campaign.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-600">
                      {campaign.effectiveContent?.subject || campaign.subject || 'No email subject assigned yet.'}
                    </p>
                    {/* Show inferred state badges */}
                    {campaign.state && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {campaign.state.isSaved && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Saved
                          </span>
                        )}
                        {campaign.state.isReadyToSend && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Ready to Send
                          </span>
                        )}
                        {campaign.state.hasTemplate && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                            Template
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-right text-sm text-gray-500 md:ml-4">
                    {campaign.contact_lists && (
                      <div>
                        Audience:{' '}
                        <span className="font-semibold text-gray-900">
                          {campaign.contact_lists.name || 'Unassigned'} (
                          {campaign.contact_lists.totalContacts ?? 0})
                        </span>
                      </div>
                    )}
                    {campaign.scheduled_for && (
                      <div>
                        Scheduled:{' '}
                        <span className="font-semibold text-gray-900">
                          {new Date(campaign.scheduled_for).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      Created {new Date(campaign.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
