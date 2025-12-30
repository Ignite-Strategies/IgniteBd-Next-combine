'use client';

import { useMemo, useEffect, Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Mail, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCompanyHydration } from '@/hooks/useCompanyHydration';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';

const SetupWizard = dynamic(() => import('@/components/SetupWizard'), {
  ssr: false,
});

function GrowthDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const hasRedirectedRef = useRef(false);
  
  // Option B: URL params primary, localStorage fallback
  // If missing from URL, check localStorage and add to URL
  // If neither exists, show error instead of redirecting
  const [missingCompanyKey, setMissingCompanyKey] = useState(false);
  
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    if (typeof window === 'undefined') return;
    
    // If URL has companyHQId, we're good
    if (companyHQId) {
      setMissingCompanyKey(false);
      return;
    }
    
    // URL doesn't have companyHQId - check localStorage (Option B fallback)
    const stored = localStorage.getItem('companyHQId');
    if (stored) {
      // Add companyHQId to URL from localStorage
      hasRedirectedRef.current = true;
      console.log(`🔄 Dashboard: Adding companyHQId from localStorage to URL: ${stored}`);
      router.replace(`/growth-dashboard?companyHQId=${stored}`);
      return;
    }
    
    // Neither URL nor localStorage has companyHQId - show error
    hasRedirectedRef.current = true;
    console.warn('⚠️ Dashboard: No companyHQId in URL or localStorage');
    setMissingCompanyKey(true);
  }, [companyHQId, router]);

  // Log CompanyHQ from URL params and confirm it's set
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
      
      // ✅ CONFIRMATION: URL param is our source of truth - sync to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('companyHQId');
        if (stored !== companyHQId) {
          console.log(`🔄 Syncing localStorage to match URL param: ${companyHQId}`);
          localStorage.setItem('companyHQId', companyHQId);
        } else {
          console.log(`✅ Confirmed: localStorage matches URL param: ${companyHQId}`);
        }
      }
    }
  }, [companyHQId]);
  
  // Use the hydration hook - loads from localStorage immediately, no auto-fetch
  const { data, loading, hydrated } = useCompanyHydration(companyHQId);
  
  const companyHQ = data.companyHQ;
  const contacts = data.contacts || [];

  const hasCompany = !!companyHQ && !!companyHQId;
  const companyName = companyHQ?.companyName ?? 'Your Company';

  // Calculate total contacts - query based on companyHQId and contacts
  const totalContacts = useMemo(() => {
    const contactsArray = Array.isArray(contacts) ? contacts : [];
    // Filter by companyHQId if needed (contacts should already be filtered by companyHQId from the API)
    return contactsArray.length;
  }, [contacts]);

  // Show error if company key is missing
  if (missingCompanyKey) {
    return <CompanyKeyMissingError />;
  }

  // Show loading screen only if we have no cached data
  if (loading && !hydrated) {
    return (
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
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {hasCompany && (
        <div className="mb-6 transition-opacity duration-300 ease-in">
          <SetupWizard
            companyHQ={companyHQ}
            hasContacts={totalContacts > 0}
          />
        </div>
      )}

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

      {/* Dashboard Metric */}
      <div className="rounded-xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Dashboard Metrics
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-indigo-100">
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600">Total Contacts</div>
            <div className="text-3xl font-bold text-gray-900">
              {totalContacts.toLocaleString()}
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
