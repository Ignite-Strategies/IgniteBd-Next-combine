'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Check, Sparkles, ExternalLink, X, Search, Filter, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
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
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);
  const [source, setSource] = useState(null); // 'database' | 'apollo'
  
  // Contact association state
  const [showContactAssociation, setShowContactAssociation] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [contactsHydrated, setContactsHydrated] = useState(false);
  const [domainFilter, setDomainFilter] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Action state
  const [associating, setAssociating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!companyHQId || !ownerHydrated || !companyInput.trim()) {
      setError('Please enter a company name');
      return;
    }

    setSubmitting(true);
    setError(null);
    setCompany(null);
    setSource(null);
    setShowContactAssociation(false);
    setContactsHydrated(false);
    
    try {
      const response = await api.post('/api/companies/lookup', {
        companyHQId,
        query: companyInput.trim(),
      });

      if (response.data?.success && response.data.company) {
        setCompany(response.data.company);
        setSource(response.data.source); // 'database' or 'apollo'
        
        // Extract domain from company website for filtering
        if (response.data.company.domain || response.data.company.website) {
          const domain = response.data.company.domain || 
            response.data.company.website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          setDomainFilter(domain || '');
        }
        
        // Show contact association section after successful save
        setShowContactAssociation(true);
      } else {
        setError(response.data?.error || 'Company not found');
      }
    } catch (err) {
      console.error('Failed to investigate company:', err);
      setError(err.response?.data?.error || err.message || 'Failed to investigate company');
    } finally {
      setSubmitting(false);
    }
  };

  // Hydrate all contacts when showing contact association
  useEffect(() => {
    if (!showContactAssociation || !companyHQId || contactsHydrated) return;

    const hydrateContacts = async () => {
      try {
        const response = await api.post('/api/contacts/hydrate', {
          companyHQId,
        });

        if (response.data?.success && response.data.contacts) {
          setAllContacts(response.data.contacts || []);
          setContactsHydrated(true);
        }
      } catch (err) {
        console.error('Failed to hydrate contacts:', err);
      }
    };

    hydrateContacts();
  }, [showContactAssociation, companyHQId, contactsHydrated]);

  // Filter contacts by domain
  const filteredContacts = useMemo(() => {
    if (!domainFilter || !allContacts.length) return allContacts;
    
    const domainLower = domainFilter.toLowerCase();
    return allContacts.filter(contact => {
      if (!contact.email) return false;
      const emailDomain = contact.email.split('@')[1]?.toLowerCase();
      return emailDomain === domainLower;
    });
  }, [allContacts, domainFilter]);

  // Contact search state for association
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Filter contacts by search term
  const searchFilteredContacts = useMemo(() => {
    if (!contactSearch || !contactSearch.trim()) return [];
    
    const searchLower = contactSearch.toLowerCase();
    return filteredContacts.filter(contact => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      return name.includes(searchLower) || email.includes(searchLower);
    }).slice(0, 20);
  }, [filteredContacts, contactSearch]);

  const handleContactSelect = (contact) => {
    setSelectedContactId(contact?.id || null);
    setSelectedContact(contact);
    setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
    setShowContactDropdown(false);
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
    setShowContactAssociation(false);
    setContactsHydrated(false);
    setAllContacts([]);
    setDomainFilter('');
    setContactSearch('');
    setShowContactDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showContactDropdown && !event.target.closest('.contact-selector-container')) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContactDropdown]);

  if (!ownerHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Company Health Investigation"
          subtitle="Want to know where a prospect company stands? Are they growing and ready to buy?"
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
          title="Company Health Investigation"
          subtitle="Want to know where a prospect company stands? Are they growing and ready to buy?"
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
                  Investigate Another Company
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

            {/* Company Health Scores - Prominently Displayed */}
            <div className="mb-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-bold text-blue-900">Company Health Scores</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {company.companyHealthScore !== null && company.companyHealthScore !== undefined && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Health Score</div>
                    <div className="text-2xl font-bold text-blue-900">{company.companyHealthScore}/100</div>
                  </div>
                )}
                {company.growthScore !== null && company.growthScore !== undefined && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Growth Score</div>
                    <div className="text-2xl font-bold text-blue-900">{company.growthScore}/100</div>
                  </div>
                )}
                {company.headcount && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Headcount</div>
                    <div className="text-xl font-bold text-blue-900">{company.headcount.toLocaleString()}</div>
                  </div>
                )}
                {company.revenue && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Revenue</div>
                    <div className="text-xl font-bold text-blue-900">
                      ${(company.revenue / 1000000).toFixed(1)}M
                    </div>
                  </div>
                )}
                {company.industry && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Industry</div>
                    <div className="text-lg font-semibold text-blue-900">{company.industry}</div>
                  </div>
                )}
                {company.growthRate !== null && company.growthRate !== undefined && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-1">Growth Rate</div>
                    <div className="text-xl font-bold text-blue-900">{company.growthRate}%</div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Association - Only show after successful save */}
            {showContactAssociation && (
              <div className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Associate with Contact (Optional)
                </h3>
                
                {/* Domain Filter */}
                {domainFilter && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Domain
                    </label>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                        placeholder="e.g., acme.com"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">
                        {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Showing contacts with email domain matching: <strong>{domainFilter}</strong>
                    </p>
                  </div>
                )}

                {/* Contact Selector - Use filtered contacts */}
                <div className="mb-4 contact-selector-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Contact
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => {
                        setContactSearch(e.target.value);
                        setShowContactDropdown(true);
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      placeholder={contactsHydrated ? `Search ${filteredContacts.length} contacts...` : "Loading contacts..."}
                      disabled={!contactsHydrated}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    {selectedContact && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Contact Dropdown */}
                  {showContactDropdown && contactSearch && searchFilteredContacts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                      {searchFilteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleContactSelect(contact)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                            selectedContactId === contact.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="text-sm font-semibold text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </div>
                          {contact.email && (
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Contact Display */}
                  {selectedContact && (
                    <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                      <p className="text-xs text-green-800">
                        <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                        {selectedContact.email && <span> • {selectedContact.email}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <div className="mb-6">
                <label htmlFor="companyInput" className="block text-sm font-semibold text-gray-700 mb-2">
                  Company name
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    id="companyInput"
                    value={companyInput}
                    onChange={(e) => setCompanyInput(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Acme Corp"
                    autoFocus
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !companyInput.trim()}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Type a company name and hit submit to see their health scores
                </p>
              </div>
            </form>

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




