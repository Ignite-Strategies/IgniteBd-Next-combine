'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import BillContainer from '@/components/bill/BillContainer';

/**
 * Public bill page: /bill/[companySlug]/[part].
 * Dynamic URL: bill/companyname/billname-shortId.
 * Fetches bill + company + checkoutUrl, shows BillContainer, Pay now → Stripe.
 */
export default function BillBySlugPage() {
  const params = useParams();
  const companySlug = params?.companySlug;
  const part = params?.part;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companySlug || !part) {
      setLoading(false);
      setError('Invalid link');
      return;
    }
    const url = `/api/bills/public/${encodeURIComponent(companySlug)}/${encodeURIComponent(part)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(d));
        return res.json();
      })
      .then((d) => {
        if (d?.success) setData(d);
        else setError(d?.error || 'Failed to load bill');
      })
      .catch((e) => setError(e?.error || e?.message || 'Failed to load bill'))
      .finally(() => setLoading(false));
  }, [companySlug, part]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600">Loading bill…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900">Bill not found</h1>
          <p className="mt-2 text-gray-600">{error || 'This link may have expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  const { bill, company, checkoutUrl } = data;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BillContainer
          companyName={company?.companyName}
          bill={bill}
          checkoutUrl={checkoutUrl}
        />
      </div>
    </div>
  );
}
