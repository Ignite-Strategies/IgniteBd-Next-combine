'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useOutreachContext } from '../../layout.jsx';

export default function CampaignDetailPage({ params }) {
  const router = useRouter();
  const { campaigns } = useOutreachContext();
  const campaign = useMemo(
    () => campaigns.find((item) => item.id === params.campaignId),
    [campaigns, params.campaignId],
  );

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">Campaign not found.</p>
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={campaign.name || 'Campaign'}
          subtitle={campaign.subject || 'Email campaign overview'}
          backTo="/outreach/campaigns"
          backLabel="Back to Campaigns"
          actions={
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns/create')}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Duplicate Draft
            </button>
          }
        />

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Send className="h-5 w-5 text-gray-500" />
              Status
            </h3>
            <p className="text-sm text-gray-600 capitalize">{campaign.status || 'draft'}</p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Users className="h-5 w-5 text-gray-500" />
              Audience
            </h3>
            <p className="text-sm text-gray-600">
              {campaign.contactList?.name || 'Assign a contact list'} (
              {campaign.contactList?.totalContacts ?? 0} contacts)
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mail className="h-5 w-5 text-gray-500" />
              Email Content
            </h3>
            <dl className="space-y-3 text-sm text-gray-600">
              <div>
                <dt className="font-semibold text-gray-700">Subject</dt>
                <dd>{campaign.subject || 'Add a subject line'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Preview Text</dt>
                <dd>{campaign.previewText || 'Add preview text to boost open rates.'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
