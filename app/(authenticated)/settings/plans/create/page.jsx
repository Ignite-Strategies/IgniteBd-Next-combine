'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { DollarSign, Calendar, Save, ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function CreatePlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [interval, setInterval] = useState(''); // 'MONTH', 'YEAR', or '' for one-time
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/settings/plans/create?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!name.trim()) {
      setError('Plan name is required');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setSaving(true);

    try {
      // Convert amount to cents
      const amountCents = Math.round(parseFloat(amount) * 100);

      const response = await api.post('/api/plans', {
        name: name.trim(),
        description: description.trim() || null,
        amountCents,
        currency: currency.toLowerCase(),
        interval: interval || null, // null for one-time payments
      });

      if (response.data?.success) {
        setSuccess(true);
        // Redirect to plans list or settings
        setTimeout(() => {
          router.push('/settings/plans');
        }, 1500);
      } else {
        setError(response.data?.error || 'Failed to create plan');
      }
    } catch (err) {
      console.error('Error creating plan:', err);
      setError(err.response?.data?.error || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Plan"
          subtitle="Create a new billing plan"
          backTo="/settings/plans"
          backLabel="Back to Plans"
        />

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Plan created successfully! Redirecting...
            </div>
          )}

          {/* Plan Name */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Gold Tier – Annual"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of what this plan includes"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Amount & Currency */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Will be stored in cents</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="gbp">GBP</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interval (Recurring or One-time) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Interval
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="interval"
                  value=""
                  checked={interval === ''}
                  onChange={(e) => setInterval(e.target.value)}
                  className="mr-2"
                />
                <span>One-time payment</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="interval"
                  value="MONTH"
                  checked={interval === 'MONTH'}
                  onChange={(e) => setInterval(e.target.value)}
                  className="mr-2"
                />
                <span>Monthly recurring</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="interval"
                  value="YEAR"
                  checked={interval === 'YEAR'}
                  onChange={(e) => setInterval(e.target.value)}
                  className="mr-2"
                />
                <span>Annual recurring</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !amount}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Create Plan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreatePlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      }
    >
      <CreatePlanContent />
    </Suspense>
  );
}

