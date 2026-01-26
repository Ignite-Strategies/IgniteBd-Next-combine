'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CreditCard, CheckCircle2, XCircle, Calendar, DollarSign } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

function BillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [company, setCompany] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);

  useEffect(() => {
    // Get companyHQId from localStorage or search params
    if (typeof window !== 'undefined') {
      const storedCompanyHQ = localStorage.getItem('companyHQ');
      if (storedCompanyHQ) {
        try {
          const parsed = JSON.parse(storedCompanyHQ);
          setCompanyHQId(parsed.id);
        } catch (e) {
          console.warn('Failed to parse companyHQ', e);
        }
      }
    }

    const paramId = searchParams?.get('companyHQId');
    if (paramId) {
      setCompanyHQId(paramId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!companyHQId) return;

    const loadCompany = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/api/platform/companies/${companyHQId}`);
        if (response.data?.success) {
          setCompany(response.data.company);
        } else {
          setError('Failed to load company data');
        }
      } catch (err) {
        console.error('Error loading company:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    const loadPendingBills = async () => {
      try {
        const res = await api.get(`/api/bills/pending-for-company?companyId=${companyHQId}`);
        if (res.data?.success && Array.isArray(res.data.pending)) {
          setPendingBills(res.data.pending);
        }
      } catch (e) {
        console.warn('Could not load pending one-off bills:', e);
      }
    };

    loadCompany();
    loadPendingBills();
  }, [companyHQId]);

  const handlePay = async () => {
    if (!company || !company.plans) {
      setError('No plan selected. Please select a plan first.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await api.post('/api/stripe/checkout', {
        companyHQId: company.id,
        planId: company.plans.id,
        successUrl: `${window.location.origin}/settings/billing?success=true&companyHQId=${company.id}`,
      });

      if (response.data?.sessionId && response.data?.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      } else if (response.data?.clientSecret) {
        // Embedded checkout (if implemented)
        // For now, redirect to URL
        if (response.data?.url) {
          window.location.href = response.data.url;
        } else {
          setError('Checkout session created but no URL provided');
        }
      } else {
        setError('Invalid response from checkout API');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start checkout');
      setProcessing(false);
    }
  };

  const formatCurrency = (cents, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50';
      case 'PAST_DUE':
        return 'text-yellow-600 bg-yellow-50';
      case 'CANCELED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'PAST_DUE':
        return 'Past Due';
      case 'CANCELED':
        return 'Canceled';
      default:
        return 'No Active Plan';
    }
  };

  // Check for success message
  useEffect(() => {
    if (searchParams?.get('success') === 'true') {
      // Reload company data to show updated status
      if (companyHQId) {
        const loadCompany = async () => {
          try {
            const response = await api.get(`/api/platform/companies/${companyHQId}`);
            if (response.data?.success) {
              setCompany(response.data.company);
            }
          } catch (err) {
            console.error('Error reloading company:', err);
          }
        };
        loadCompany();
      }
    }
  }, [searchParams, companyHQId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Billing"
            subtitle="Manage your subscription and payment"
            backTo="/settings"
            backLabel="Back to Settings"
          />
          <div className="mt-8 text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Billing"
          subtitle="Manage your subscription and payment"
          backTo="/settings"
          backLabel="Back to Settings"
        />

        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Outstanding one-off bills (b): pay here if user lost email link */}
        {companyHQId && pendingBills.length > 0 && (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Outstanding one-off bills</h3>
            <p className="text-sm text-gray-600 mb-4">
              You have pending one-off bills. Pay below if you lost the link from your email.
            </p>
            <ul className="space-y-3">
              {pendingBills.map((b) => (
                <li
                  key={b.billSendId}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{b.billName}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(b.amountCents, b.currency)}
                      {b.description && ` · ${b.description}`}
                    </p>
                  </div>
                  <a
                    href={b.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                  >
                    Pay
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searchParams?.get('success') === 'true' && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Payment successful! Your subscription is now active.
          </div>
        )}

        <div className="mt-8">
          {!company ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No company found. Please select a company first.</p>
            </div>
          ) : !company.plans ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="text-center">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plan Selected</h3>
                <p className="text-gray-600 mb-6">
                  You don't have a billing plan yet. Please select a plan to continue.
                </p>
                <button
                  onClick={() => router.push('/settings/plans')}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  View Plans
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">This Month's Bill</h2>
                  <p className="text-gray-600">Your current billing information</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(company.planStatus)}`}>
                  {getStatusLabel(company.planStatus)}
                </div>
              </div>

              <div className="space-y-6">
                {/* Plan Details */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Plan Name</p>
                      <p className="text-lg font-medium text-gray-900">{company.plans.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Amount</p>
                      <p className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {formatCurrency(company.plans.amountCents, company.plans.currency)}
                      </p>
                    </div>
                    {company.plans.interval && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Billing Interval</p>
                        <p className="text-lg font-medium text-gray-900 flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {company.plans.interval === 'MONTH' ? 'Monthly' : 'Annual'}
                        </p>
                      </div>
                    )}
                    {company.plans.description && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Description</p>
                        <p className="text-sm text-gray-900">{company.plans.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Status */}
                {company.planStartedAt && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Plan Started</p>
                        <p className="text-sm text-gray-900">
                          {new Date(company.planStartedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {company.planEndedAt && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Plan Ends</p>
                          <p className="text-sm text-gray-900">
                            {new Date(company.planEndedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pay Button */}
                {company.planStatus !== 'ACTIVE' && (
                  <div className="border-t border-gray-200 pt-6">
                    <button
                      onClick={handlePay}
                      disabled={processing}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5" />
                          Pay Now
                        </>
                      )}
                    </button>
                  </div>
                )}

                {company.planStatus === 'ACTIVE' && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="text-sm font-medium">Your subscription is active</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}


