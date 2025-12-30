'use client';

import { useMemo, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Users, TrendingUp, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useLocalStorage } from '@/hooks/useLocalStorage.js';
import { useDynamics } from '@/hooks/useDynamics.js';
import api from '@/lib/api';

function CompaniesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [companies, setCompanies] = useLocalStorage('companies', []);
  const [contacts, setContacts] = useState([]);
  const { syncAccounts, loading } = useDynamics();

  // Fetch contacts from API - NO localStorage
  useEffect(() => {
    if (!companyHQId) return;

    const fetchContacts = async () => {
      try {
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        if (response.data?.success && Array.isArray(response.data.contacts)) {
          setContacts(response.data.contacts);
        }
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
        setContacts([]);
      }
    };

    fetchContacts();
  }, [companyHQId]);

  const contactCounts = useMemo(() => {
    return contacts.reduce((acc, contact) => {
      const companyName = contact.contactCompany?.companyName || contact.company;
      if (!companyName) return acc;
      const total = acc.get(companyName) ?? 0;
      acc.set(companyName, total + 1);
      return acc;
    }, new Map());
  }, [contacts]);

  const handleSync = async () => {
    const result = await syncAccounts();
    if (result?.success) {
      const updatedCompanies = JSON.parse(
        window.localStorage.getItem('companies') || '[]',
      );
      setCompanies(updatedCompanies);
      alert(`Synced ${result.count} companies from Dynamics 365.`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Companies"
          subtitle="Review firms synced from Dynamics 365 and their engagement health."
          backTo="/people"
          backLabel="Back to People Hub"
          actions={
            companies.length > 0 ? (
              <button
                type="button"
                onClick={handleSync}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {loading ? 'Syncing…' : 'Sync from Dynamics 365'}
              </button>
            ) : null
          }
        />

        {companies.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <Building2 className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-lg font-semibold text-gray-800">No companies yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Connect Dynamics 365 to import your accounts.
            </p>
            <button
              type="button"
              onClick={handleSync}
              disabled={loading}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Syncing…' : 'Sync from Dynamics 365'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const totalContacts =
                contactCounts.get(company.name || company.companyName) ?? 0;
              const openOpportunities = company.opportunities?.length ?? 0;
              return (
                <div
                  key={company.id || company.name}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                        <Building2 className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {company.name || company.companyName || 'Company'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {company.industry || 'Industry pending'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <dl className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2 text-gray-600">
                        <Users className="h-4 w-4" />
                        Contacts
                      </dt>
                      <dd className="font-semibold text-gray-900">
                        {totalContacts}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2 text-gray-600">
                        <TrendingUp className="h-4 w-4" />
                        Opportunities
                      </dt>
                      <dd className="font-semibold text-gray-900">
                        {openOpportunities}
                      </dd>
                    </div>
                    {company.location && (
                      <div className="text-sm text-gray-500">📍 {company.location}</div>
                    )}
                    {company.employees && (
                      <div className="text-sm text-gray-500">
                        👥 {company.employees.toLocaleString()} employees
                      </div>
                    )}
                  </dl>

                  <button
                    type="button"
                    onClick={() => router.push('/people')}
                    className="mt-6 w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    View in People Hub
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CompaniesPageContent />
    </Suspense>
  );
}
