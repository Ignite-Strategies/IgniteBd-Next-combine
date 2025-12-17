'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

const DEFAULT_FORM = {
  clientName: '',
  clientCompany: '',
  purpose: '',
  totalPrice: '',
};

export default function ProposalBuilderPage() {
  const router = useRouter();
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const companyHQId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      ''
    );
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!companyHQId) {
      setError('Missing company context. Please complete onboarding first.');
      return;
    }
    if (!formValues.clientName || !formValues.clientCompany) {
      setError('Client name and company are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        companyHQId,
        clientName: formValues.clientName.trim(),
        clientCompany: formValues.clientCompany.trim(),
        purpose: formValues.purpose.trim(),
        totalPrice: formValues.totalPrice
          ? Number.parseFloat(formValues.totalPrice.replace(/[^0-9.]/g, ''))
          : null,
        status: 'draft',
        preparedBy: typeof window !== 'undefined' ? window.localStorage.getItem('ownerId') : null,
      };
      const response = await api.post('/api/proposals', payload);
      const proposal = response.data?.proposal;
      if (!proposal) {
        throw new Error('Proposal response missing payload');
      }
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      console.error(err);
      setError('Unable to save proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Proposal Builder"
          subtitle="Draft scope, pricing, and next steps for your client."
          backTo="/proposals"
          backLabel="Back to Proposals"
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
                Client Name *
              </label>
              <input
                name="clientName"
                value={formValues.clientName}
                onChange={handleChange}
                placeholder="e.g., Jordan Williams"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Client Company *
              </label>
              <input
                name="clientCompany"
                value={formValues.clientCompany}
                onChange={handleChange}
                placeholder="Company name"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Purpose / Summary
              </label>
              <textarea
                name="purpose"
                value={formValues.purpose}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the engagement objective, desired outcomes, or solution."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Total Price (optional)
              </label>
              <input
                name="totalPrice"
                value={formValues.totalPrice}
                onChange={handleChange}
                placeholder="$12,000"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={submitting}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() => router.push('/proposals')}
                className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
