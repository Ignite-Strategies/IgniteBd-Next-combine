'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Mail, Users, RefreshCw } from 'lucide-react';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';
import api from '@/lib/api';

function GrowthDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // URL param is source of truth - welcome page sets it, no checking needed
  const missingCompanyKey = !companyHQId;

  const [companyHQ, setCompanyHQ] = useState(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch company data and metrics from API
  useEffect(() => {
    if (typeof window === 'undefined' || !companyHQId) {
      setLoading(false);
      return;
    }
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch companyHQ data from localStorage (fallback) or API
        const stored = localStorage.getItem('companyHQ');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Only use if it matches the current companyHQId
            if (parsed.id === companyHQId) {
              setCompanyHQ(parsed);
            }
          } catch (e) {
            console.warn('Failed to parse companyHQ from localStorage', e);
          }
        }

        // Fetch contacts count from API - company-scoped
        console.log('📊 Fetching contact metrics for companyHQId:', companyHQId);
        const contactsResponse = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        
        if (contactsResponse.data?.success && Array.isArray(contactsResponse.data.contacts)) {
          const contacts = contactsResponse.data.contacts;
          const count = contacts.length;
          console.log(`✅ Fetched ${count} contacts (company-scoped) for companyHQId: ${companyHQId}`);
          setTotalContacts(count);
        } else {
          console.warn('⚠️ API response missing contacts array:', contactsResponse.data);
          setTotalContacts(0);
        }
      } catch (err) {
        console.error('❌ Error fetching dashboard metrics:', err);
        setError(err.message || 'Failed to load metrics');
        setTotalContacts(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [companyHQId]);

  const hasCompany = !!companyHQ && !!companyHQId;
  const companyName = companyHQ?.companyName ?? 'Your Company';

  // Refresh metrics
  const refreshMetrics = async () => {
    if (!companyHQId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const contactsResponse = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      
      if (contactsResponse.data?.success && Array.isArray(contactsResponse.data.contacts)) {
        const count = contactsResponse.data.contacts.length;
        setTotalContacts(count);
        console.log(`✅ Refreshed metrics: ${count} contacts`);
      }
    } catch (err) {
      console.error('❌ Error refreshing metrics:', err);
      setError(err.message || 'Failed to refresh metrics');
    } finally {
      setLoading(false);
    }
  };

  // Show error if company key is missing
  if (missingCompanyKey) {
    return <CompanyKeyMissingError />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {hasCompany ? `${companyName} Growth Dashboard` : 'Growth Dashboard'}
        </h1>
        <p className="text-gray-600">
          {hasCompany
            ? `Your command center for ${companyName}`
            : 'Your command center for business development'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => router.push(companyHQId ? `/people/load?companyHQId=${companyHQId}` : '/people/load')}
            className="group flex items-center gap-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 transition-transform group-hover:scale-110">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Upload Contacts</div>
              <div className="text-sm text-gray-600">
                Choose how to add contacts: CSV, LinkedIn, Microsoft, or manual
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push(companyHQId ? `/outreach/compose?companyHQId=${companyHQId}` : '/outreach/compose')}
            className="group flex items-center gap-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-4 text-left transition hover:border-purple-300 hover:bg-purple-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 transition-transform group-hover:scale-110">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Send Email</div>
              <div className="text-sm text-gray-600">
                Compose and send emails to your contacts
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Dashboard Metrics
          </h3>
          <button
            onClick={refreshMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-indigo-100">
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-600">Total Contacts</div>
            {loading ? (
              <div className="text-3xl font-bold text-gray-400">...</div>
            ) : (
              <div className="text-3xl font-bold text-gray-900">
                {totalContacts.toLocaleString()}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Company-scoped count
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GrowthDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Getting your dashboard ready...
          </h2>
          <p className="text-gray-600">
            Loading your company data and metrics
          </p>
        </div>
      </div>
    }>
      <GrowthDashboardPageContent />
    </Suspense>
  );
}
