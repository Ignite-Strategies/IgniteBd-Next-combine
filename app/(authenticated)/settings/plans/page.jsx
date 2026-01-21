'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, DollarSign, Calendar, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function PlansPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/settings/plans?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/plans');
      if (response.data?.success) {
        setPlans(response.data.plans || []);
      }
    } catch (err) {
      console.error('Error loading plans:', err);
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Billing Plans"
          subtitle="Manage subscription and one-time payment plans"
        />

        <div className="mt-8 flex justify-end mb-6">
          <button
            onClick={() => router.push(`/settings/plans/create${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No plans created yet</p>
            <button
              onClick={() => router.push(`/settings/plans/create${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-semibold">{formatCurrency(plan.amountCents, plan.currency)}</span>
                  </div>
                  {plan.interval && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {plan.interval === 'MONTH' ? 'Monthly' : 'Annual'} billing
                      </span>
                    </div>
                  )}
                  {!plan.interval && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="text-sm">One-time payment</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      }
    >
      <PlansPageContent />
    </Suspense>
  );
}

