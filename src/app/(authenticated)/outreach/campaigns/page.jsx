'use client';

import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useOutreachContext } from '../layout.jsx';

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, hydrating, refreshCampaigns } = useOutreachContext();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Campaigns"
          subtitle="Manage nurture journeys, one-off sends, and follow-ups."
          backTo="/outreach"
          backLabel="Back to Outreach"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => refreshCampaigns()}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-100"
              >
                <RefreshCw className={hydrating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/outreach/campaigns/create')}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                New Campaign
              </button>
            </div>
          }
        />

        {campaigns.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">No campaigns yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Launch your first campaign to start building momentum.
            </p>
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns/create')}
              className="mt-6 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              Create Campaign →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => router.push(`/outreach/campaigns/${campaign.id}`)}
                className="flex w-full flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {campaign.type || 'Email Campaign'}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-gray-900">
                    {campaign.name || 'Untitled Campaign'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {campaign.subject || 'No email subject assigned yet.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-right text-sm text-gray-500">
                  <div>
                    Status:{' '}
                    <span className="font-semibold text-gray-900">
                      {campaign.status || 'draft'}
                    </span>
                  </div>
                  <div>
                    Audience:{' '}
                    <span className="font-semibold text-gray-900">
                      {campaign.contactList?.name || 'Unassigned'} (
                      {campaign.contactList?.totalContacts ?? 0})
                    </span>
                  </div>
                  {campaign.scheduledFor && (
                    <div>
                      Scheduled:{' '}
                      <span className="font-semibold text-gray-900">
                        {new Date(campaign.scheduledFor).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
