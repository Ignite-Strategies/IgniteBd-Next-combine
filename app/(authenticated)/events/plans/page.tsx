'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Calendar, Loader2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

interface EventPlan {
  id: string;
  name: string;
  description?: string | null;
  year?: number | null;
  totalCost?: number | null;
  totalTrips?: number | null;
  createdAt: string;
  _count?: {
    event_plan_opps: number;
  };
}

export default function EventPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<EventPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || '';
      const ownerId = localStorage.getItem('ownerId') || '';

      if (!companyHQId || !ownerId) {
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/event-plans/list?companyHQId=${companyHQId}&ownerId=${ownerId}`);
      
      if (response.data?.success) {
        setPlans(response.data.plans || []);
      }
    } catch (err: any) {
      console.error('Error loading plans:', err);
      alert(err.response?.data?.error || 'Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Event Plans"
          subtitle="View and manage your event plans"
          backTo="/events"
          backLabel="Back to Events"
        />

        {plans.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-xl border border-gray-200 bg-white">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No event plans yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Create your first event plan by setting your program constraints
            </p>
            <button
              onClick={() => router.push('/events/set-plan')}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Set Your Plan
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => router.push(`/events/plans/${plan.id}`)}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-gray-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      {plan.year && (
                        <p className="text-sm text-gray-500">Year: {plan.year}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>

                {plan.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{plan.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span>{plan._count?.event_plan_opps || 0} events</span>
                  {plan.totalCost && (
                    <span>${plan.totalCost.toLocaleString()} total</span>
                  )}
                  {plan.totalTrips && (
                    <span>{plan.totalTrips} trips</span>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Created {formatDate(plan.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

