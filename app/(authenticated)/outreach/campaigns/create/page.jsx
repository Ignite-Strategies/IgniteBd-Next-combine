'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';

export default function CampaignCreatePage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Immediately create a draft campaign and redirect to edit page
    const createCampaign = async () => {
      if (!companyHQId) {
        // Wait for companyHQId to be available
        return;
      }

      if (creating) return; // Prevent double creation

      setCreating(true);
      setError('');

      try {
        const response = await api.post('/api/campaigns', {
          name: 'Untitled Campaign',
          description: null,
          company_hq_id: companyHQId,
          status: 'DRAFT',
        });

        if (response.data?.success && response.data.campaign?.id) {
          // Redirect to edit page
          router.push(`/outreach/campaigns/${response.data.campaign.id}/edit`);
        } else {
          setError(response.data?.error || 'Failed to create campaign');
        }
      } catch (error) {
        console.error('Error creating campaign:', error);
        setError(error.response?.data?.error || 'Failed to create campaign');
        setCreating(false);
      }
    };

    createCampaign();
  }, [companyHQId, router, creating]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Create Campaign"
            subtitle="Setting up your new campaign..."
            backTo="/outreach/campaigns"
            backLabel="Back to Campaigns"
          />
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns')}
              className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
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
          title="Create Campaign"
          subtitle="Setting up your new campaign..."
          backTo="/outreach/campaigns"
          backLabel="Back to Campaigns"
        />
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-red-600" />
              <p className="text-gray-600">Creating campaign...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
