'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Sparkles, Search, ExternalLink, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { useOwner } from '@/hooks/useOwner';
import api from '@/lib/api';

export default function CompanyHubPage() {
  const router = useRouter();
  const { companyHQId, hydrated: ownerHydrated } = useOwner();
  
  // Search state
  const [companySearch, setCompanySearch] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [company, setCompany] = useState(null);
  const [source, setSource] = useState(null); // 'database' | 'apollo'
  
  // Association state
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Action state
  const [associating, setAssociating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Lookup company when user stops typing
  useEffect(() => {
    if (!companyHQId || !ownerHydrated) return;
    
    if (companySearch.length < 2) {
      setCompany(null);
      setSource(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLookingUp(true);
      setError(null);
      
      try {
        const response = await api.post('/api/companies/lookup', {
          companyHQId,
          query: companySearch.trim(),
        });

        if (response.data?.success && response.data.company) {
          setCompany(response.data.company);
          setSource(response.data.source); // 'database' or 'apollo'
        } else {
          setCompany(null);
          setError(response.data?.error || 'Company not found');
        }
      } catch (err) {
        console.error('Failed to lookup company:', err);
        setCompany(null);
        setError(err.response?.data?.error || err.message || 'Failed to lookup company');
      } finally {
        setLookingUp(false);
      }
    }, 500); // Slightly longer delay to avoid too many API calls

    return () => clearTimeout(timeoutId);
  }, [companySearch, companyHQId, ownerHydrated]);

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
    setCompanySearch('');
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
          subtitle="Look up company details from database or Apollo"
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
                  Look Up Another Company
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
          /* Search View */
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="mb-6">
              <label htmlFor="companySearch" className="block text-sm font-semibold text-gray-700 mb-2">
                Look Up Company
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="companySearch"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full pl-10 pr-10 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type company name or website (e.g., 'Acme Corp' or 'acme.com')..."
                  autoFocus
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Searches database first, then Apollo if not found. Saves API calls automatically.
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
