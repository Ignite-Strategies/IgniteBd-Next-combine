'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Public plan checkout: /plan-checkout/[companySlug]/[planId]
 * Creates a Stripe Checkout session and redirects. No auth required.
 * Send this URL to the customer after assigning the plan.
 */
export default function PlanCheckoutPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string | undefined;
  const planId = params?.planId as string | undefined;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug || !planId) {
      setError('Invalid checkout link.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/public/plan-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companySlug: decodeURIComponent(companySlug),
            planId: decodeURIComponent(planId),
          }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.success) {
          setError(data.error || 'Could not start checkout.');
          return;
        }

        if (data.url) {
          window.location.href = data.url;
          return;
        }

        setError('No payment link received.');
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Something went wrong. Please try again.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companySlug, planId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Checkout unavailable
          </h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-red-600 mx-auto mb-4" />
        <p className="text-sm text-gray-600">Taking you to secure payment…</p>
      </div>
    </div>
  );
}
