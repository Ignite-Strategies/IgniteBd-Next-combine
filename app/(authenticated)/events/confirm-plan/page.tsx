'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

export default function ConfirmPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdsParam = searchParams.get('eventIds');
  const tunerId = searchParams.get('tunerId');
  const { ownerId, companyHQId, hydrated } = useOwner();

  const [eventIds] = useState<string[]>(() => {
    return eventIdsParam ? eventIdsParam.split(',').filter(Boolean) : [];
  });
  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!planName.trim()) {
      alert('Please enter a plan name.');
      return;
    }

    if (!ownerId || !companyHQId) {
      alert('Please ensure you are logged in.');
      return;
    }

    try {
      setSaving(true);

      const response = await api.post('/api/event-plans/create', {
        companyHQId,
        ownerId,
        name: planName.trim(),
        description: description.trim() || null,
        year,
        eventOpIds: eventIds,
      });

      if (response.data?.success) {
        // Success! Redirect to plans page
        router.push('/events/plans');
      } else {
        throw new Error('Failed to create plan');
      }
    } catch (err: any) {
      console.error('Error creating plan:', err);
      alert(err.response?.data?.error || 'Failed to create plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Confirm and Name Your Plan"
          subtitle={`You've chosen ${eventIds.length} event${eventIds.length !== 1 ? 's' : ''}. Let's lock in your plan.`}
          backTo={`/events/plan-picker${tunerId ? `?tunerId=${tunerId}` : ''}`}
          backLabel="Back to Event Picker"
        />

        <div className="mt-8">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="planName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Plan Name *
                </label>
                <input
                  id="planName"
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g., Q1 2025 Event Roadmap"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Give your event plan a descriptive name
                </p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any notes about this plan..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-semibold text-gray-700 mb-2">
                  Year
                </label>
                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  min={2020}
                  max={2030}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{eventIds.length}</span> event{eventIds.length !== 1 ? 's' : ''} will be added to this plan
                  </p>
                  <button
                    type="submit"
                    disabled={saving || !planName.trim()}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      saving || !planName.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating Plan...</span>
                      </>
                    ) : (
                      'Create Plan'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

