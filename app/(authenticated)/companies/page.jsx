'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Check, X, Sparkles, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { useOwner } from '@/hooks/useOwner';
import api from '@/lib/api';

export default function CompanyHubPage() {
  const router = useRouter();
  const { companyHQId, hydrated: ownerHydrated } = useOwner();
  
  // Search state
  const [companySearch, setCompanySearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  
  // Create state (only shown if not found)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  
  // Association state
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Action state
  const [creating, setCreating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdCompany, setCreatedCompany] = useState(null);
  const [error, setError] = useState(null);

  // Search companies as user types
  useEffect(() => {
    if (!companyHQId || !ownerHydrated) return;
    
    if (companySearch.length < 2) {
      setSearchResults([]);
      setShowCreateForm(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get(
          `/api/companies?companyHQId=${companyHQId}&query=${encodeURIComponent(companySearch)}`
        );
        if (response.data?.success) {
          const results = response.data.companies || [];
          setSearchResults(results);
          // Show create form if no results found
          setShowCreateForm(results.length === 0);
        }
      } catch (err) {
        console.error('Failed to search companies:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [companySearch, companyHQId, ownerHydrated]);

  // Auto-fill create form from search query
  useEffect(() => {
    if (showCreateForm && companySearch.trim() && !companyName) {
      setCompanyName(companySearch.trim());
    }
  }, [showCreateForm, companySearch, companyName]);

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setCompanySearch(company.companyName);
    setSearchResults([]);
    setShowCreateForm(false);
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required. Please refresh the page.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(false);

    try {
      // Create the company
      const response = await api.post('/api/companies', {
        companyHQId,
        companyName: companyName.trim(),
        website: website.trim() || undefined,
      });

      if (response.data?.success && response.data.company) {
        const newCompany = response.data.company;
        setSelectedCompany(newCompany);
        setCreatedCompany(newCompany);

        // Auto-enrich if website is provided
        if (website.trim() || newCompany.website || newCompany.domain) {
          try {
            const enriched = await handleEnrichCompany(
              newCompany.id,
              website.trim() || newCompany.website || newCompany.domain
            );
            if (enriched) {
              setCreatedCompany(enriched);
              setSelectedCompany(enriched);
            }
          } catch (enrichError) {
            console.error('Auto-enrichment failed:', enrichError);
            // Continue - enrichment is optional
          }
        }

        // Optionally associate with contact if one is selected
        if (selectedContactId) {
          try {
            await api.put(`/api/contacts/${selectedContactId}`, {
              companyId: newCompany.id,
            });
          } catch (assocError) {
            console.error('Failed to associate contact:', assocError);
            // Don't fail the whole operation if association fails
          }
        }

        setSuccess(true);
      } else {
        setError(response.data?.error || 'Failed to create company');
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleContactSelect = (contact, company) => {
    setSelectedContactId(contact?.id || null);
    setSelectedContact(contact);
  };

  const handleEnrichCompany = async (companyId, websiteOrDomain) => {
    setEnriching(true);
    setError(null);

    try {
      // Extract domain from website if it's a URL
      let domain = websiteOrDomain;
      if (websiteOrDomain && websiteOrDomain.includes('://')) {
        try {
          const url = new URL(websiteOrDomain);
          domain = url.hostname.replace(/^www\./, '');
        } catch {
          // If URL parsing fails, try to extract domain manually
          domain = websiteOrDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        }
      }

      const response = await api.post('/api/companies/enrich', {
        companyId,
        domain: domain,
        website: websiteOrDomain?.includes('://') ? websiteOrDomain : undefined,
      });

      if (response.data?.success && response.data.company) {
        setCreatedCompany(response.data.company);
        return response.data.company;
      } else {
        throw new Error(response.data?.error || 'Enrichment failed');
      }
    } catch (err) {
      console.error('Failed to enrich company:', err);
      setError(err.response?.data?.error || err.message || 'Failed to enrich company');
      throw err;
    } finally {
      setEnriching(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setCreatedCompany(null);
    setSelectedCompany(null);
    setCompanySearch('');
    setCompanyName('');
    setWebsite('');
    setSelectedContactId(null);
    setSelectedContact(null);
    setShowCreateForm(false);
    setSearchResults([]);
    setError(null);
  };

  const handleSaveAndContinue = () => {
    if (!selectedCompany) return;
    
    // Associate with contact if selected
    if (selectedContactId) {
      api.put(`/api/contacts/${selectedContactId}`, {
        companyId: selectedCompany.id,
      }).catch(err => {
        console.error('Failed to associate contact:', err);
      });
    }
    
    setSuccess(true);
    setCreatedCompany(selectedCompany);
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
          subtitle="Add a company and optionally associate it with a contact"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {success && (createdCompany || selectedCompany) ? (
          (() => {
            const company = createdCompany || selectedCompany;
            return (
              <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">
                Company Created!
              </h2>
              <p className="mb-4 text-gray-600">
                <strong>{company.companyName}</strong> {createdCompany ? 'has been created' : 'has been selected'} successfully.
                {selectedContactId && ' It has been associated with the selected contact.'}
              </p>
              
              {/* Show enrichment status if available */}
              {company.companyHealthScore !== null && company.companyHealthScore !== undefined && (
                <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Company Enriched</h3>
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
                  </div>
                </div>
              )}

              {/* Enrich button if not enriched yet */}
              {(!company.companyHealthScore && (company.website || company.domain)) && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => handleEnrichCompany(company.id, company.website || company.domain)}
                    disabled={enriching}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enriching ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Enriching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Enrich Company with Intelligence Data
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-sm text-gray-500 text-center">
                    Get health scores, growth metrics, and company intelligence
                  </p>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Add Another Company
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/people')}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Go to People Hub
                </button>
              </div>
            </div>
          </div>
            );
          })()
        ) : selectedCompany && !success ? (
          // Company selected - show association option
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedCompany.companyName}</h3>
                  {selectedCompany.website && (
                    <p className="text-sm text-gray-500">{selectedCompany.website}</p>
                  )}
                </div>
              </div>
            </div>

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

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedCompany(null);
                  setCompanySearch('');
                }}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSaveAndContinue}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                <Check className="h-5 w-5" />
                Continue
              </button>
            </div>
          </div>
        ) : (
          // Search/Create view
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="mb-6">
              <label htmlFor="companySearch" className="block text-sm font-semibold text-gray-700 mb-2">
                Search for Company
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="companySearch"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full pl-10 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type company name or website..."
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Search existing companies or create a new one
              </p>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Company</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => handleSelectCompany(company)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{company.companyName}</p>
                          {company.website && (
                            <p className="text-sm text-gray-500">{company.website}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create Form (shown when no results) */}
            {showCreateForm && (
              <div className="mb-6 rounded-lg border border-gray-200 p-6 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Create New Company</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="newCompanyName" className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="newCompanyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="newWebsite" className="block text-sm font-medium text-gray-700 mb-2">
                      Website (Optional)
                    </label>
                    <input
                      type="url"
                      id="newWebsite"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Adding a website will automatically enrich company data
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateCompany}
                    disabled={creating || !companyName.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Company
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

