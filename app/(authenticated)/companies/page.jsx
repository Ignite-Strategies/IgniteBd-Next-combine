'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Check, Sparkles, ExternalLink, X, Zap } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import api from '@/lib/api';

function CompanyHubPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Direct read from localStorage for ownerId - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  const [ownerHydrated, setOwnerHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) {
      setOwnerId(stored);
      setOwnerHydrated(true);
    }
  }, []);
  
  // Input state
  const [companyInput, setCompanyInput] = useState('');
  const [hydrating, setHydrating] = useState(false);
  const [company, setCompany] = useState(null);
  const [source, setSource] = useState(null); // 'database' | 'apollo'
  
  // Association state
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Action state
  const [associating, setAssociating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleHydrateCompany = async () => {
    if (!companyHQId || !ownerHydrated || !companyInput.trim()) {
      setError('Please enter a company name or domain');
      return;
    }

    setHydrating(true);
    setError(null);
    setCompany(null);
    setSource(null);
    
    try {
      const response = await api.post('/api/companies/lookup', {
        companyHQId,
        query: companyInput.trim(),
      });

      if (response.data?.success && response.data.company) {
        setCompany(response.data.company);
        setSource(response.data.source); // 'database' or 'apollo'
      } else {
        setError(response.data?.error || 'Company not found');
      }
    } catch (err) {
      console.error('Failed to hydrate company:', err);
      setError(err.response?.data?.error || err.message || 'Failed to hydrate company');
    } finally {
      setHydrating(false);
    }
  };

  const handleContactSelect = (contact, company) => {
    setSelectedContactId(contact?.id || null);
    setSelectedContact(contact);
  };

  const handleAssociateContact = async () => {
    if (!selectedContactId || !company) return;

    setAssociating(true);
    setError(null);

    try {
      await api.put(`/api/contacts/${selectedContactId}`, {
        companyId: company.id,
      });
      setSuccess(true);
    } catch (err) {
      console.error('Failed to associate contact:', err);
      setError(err.response?.data?.error || err.message || 'Failed to associate contact');
    } finally {
      setAssociating(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setCompany(null);
    setSource(null);
    setCompanyInput('');
    setSelectedContactId(null);
    setSelectedContact(null);
    setError(null);
  };

  if (!ownerHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="🏢 Company Hub"
            subtitle="Manage prospect and client companies"
            backTo="/growth-dashboard"
            backLabel="Back to Growth Dashboard"
          />
          <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="🏢 Company Hub"
          subtitle="Give us a company and we'll hydrate it. Optionally associate a contact."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {/* Success Message */}
        {success ? (
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">
                Contact Associated!
              </h2>
              <p className="mb-4 text-gray-600">
                Company has been associated with the selected contact.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Hydrate Another Company
                </button>
              </div>
            </div>
          </div>
        ) : company ? (
          /* Company Details View */
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            {/* Company Header */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{company.companyName}</h2>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-1"
                      >
                        {company.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {source && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {source === 'database' ? 'From Database' : 'Enriched from Apollo'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Company Intelligence Scores */}
            {company.companyHealthScore !== null && company.companyHealthScore !== undefined && (
              <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Company Intelligence</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Health Score:</span>
                    <span className="ml-2 font-semibold text-blue-900">{company.companyHealthScore}/100</span>
                  </div>
                  {company.growthScore !== null && (
                    <div>
                      <span className="text-blue-700">Growth Score:</span>
                      <span className="ml-2 font-semibold text-blue-900">{company.growthScore}/100</span>
                    </div>
                  )}
                  {company.headcount && (
                    <div>
                      <span className="text-blue-700">Headcount:</span>
                      <span className="ml-2 font-semibold text-blue-900">{company.headcount.toLocaleString()}</span>
                    </div>
                  )}
                  {company.revenue && (
                    <div>
                      <span className="text-blue-700">Revenue:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        ${(company.revenue / 1000000).toFixed(1)}M
                      </span>
                    </div>
                  )}
                  {company.industry && (
                    <div>
                      <span className="text-blue-700">Industry:</span>
                      <span className="ml-2 font-semibold text-blue-900">{company.industry}</span>
                    </div>
                  )}
                  {company.growthRate !== null && company.growthRate !== undefined && (
                    <div>
                      <span className="text-blue-700">Growth Rate:</span>
                      <span className="ml-2 font-semibold text-blue-900">{company.growthRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Association */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Associate with Contact (Optional)
              </label>
              <ContactSelector
                contactId={selectedContactId}
                onContactSelect={handleContactSelect}
                selectedContact={selectedContact}
                showLabel={false}
              />
              <p className="mt-2 text-sm text-gray-500">
                Search for a contact to associate this company with
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {selectedContactId && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAssociateContact}
                  disabled={associating}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {associating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Associating...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Associate with Contact
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Input View */
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="mb-6">
              <label htmlFor="companyInput" className="block text-sm font-semibold text-gray-700 mb-2">
                Company Name or Domain
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  id="companyInput"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !hydrating && companyInput.trim()) {
                      handleHydrateCompany();
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 'Acme Corp' or 'acme.com'"
                  autoFocus
                  disabled={hydrating}
                />
                <button
                  type="button"
                  onClick={handleHydrateCompany}
                  disabled={hydrating || !companyInput.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {hydrating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Hydrating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      Hydrate Company
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                We'll search the database first, then enrich from Apollo if needed.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanyHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CompanyHubPageContent />
    </Suspense>
  );
}
