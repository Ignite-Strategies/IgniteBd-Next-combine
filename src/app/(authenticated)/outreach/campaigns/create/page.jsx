'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useOutreachContext } from '../../layout.jsx';

const DEFAULT_FORM = {
  name: '',
  subject: '',
  previewText: '',
};

export default function CampaignCreatePage() {
  const router = useRouter();
  const { campaigns, setCampaigns } = useOutreachContext();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Campaign name is required.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const draft = {
        id: `draft-${Date.now()}`,
        name: form.name.trim(),
        subject: form.subject.trim(),
        previewText: form.previewText.trim(),
        status: 'draft',
        contactList: null,
        createdAt: new Date().toISOString(),
      };
      const nextCampaigns = [draft, ...campaigns];
      setCampaigns(nextCampaigns);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('outreachCampaigns', JSON.stringify(nextCampaigns));
      }
      router.push(`/outreach/campaigns/${draft.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Campaign Builder"
          subtitle="Draft a high-performing nurture sequence."
          backTo="/outreach/campaigns"
          backLabel="Back to Campaigns"
        />

        <div className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Campaign Name *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Q1 Customer Reactivation"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Email Subject
              </label>
              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Ready to accelerate your 2025 pipeline?"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Preview Text
              </label>
              <textarea
                name="previewText"
                value={form.previewText}
                onChange={handleChange}
                rows={3}
                placeholder="Short snippet that shows in inbox previews."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={saving}
              />
            </div>
            <p className="text-xs text-gray-500">
              Content editor, list selection, and scheduling will be migrated from the React app next.
            </p>
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() => router.push('/outreach/campaigns')}
                className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
