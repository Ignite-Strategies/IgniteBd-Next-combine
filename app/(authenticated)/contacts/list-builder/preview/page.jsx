'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users, Building2, Filter, Check, X, ArrowLeft, Save } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useContactLists } from '../../ContactListsContext';
import { useContacts } from '../../ContactsContext';
import CompanySelector from '@/components/CompanySelector';
import { OFFICIAL_PIPELINES, PIPELINE_STAGES } from '@/lib/config/pipelineConfig';

function ContactListPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterType = searchParams.get('filter') || 'all';
  const selectAllParam = searchParams.get('selectAll') === 'true';
  const returnTo = searchParams.get('returnTo');
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const { contacts, hydrated, refreshContacts } = useContacts(); // Use existing ContactsContext
  const { addList } = useContactLists();
  
  // Direct read from localStorage for ownerId - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);
  
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter-specific state
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Refresh contacts if not hydrated
  useEffect(() => {
    if (!hydrated && companyHQId) {
      refreshContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, companyHQId]); // refreshContacts is stable from context, only need hydrated and companyHQId

  // Filter contacts based on selected filter type (without search - for selectAll)
  const qualifyingContacts = useMemo(() => {
    let filtered = [...contacts];

    // Apply filter type only (no search filtering for selectAll)
    if (filterType === 'all') {
      // Show all contacts - no filtering by type
      filtered = contacts;
    } else if (filterType === 'company' && selectedCompanyId) {
      filtered = contacts.filter((contact) => {
        return contact.contactCompanyId === selectedCompanyId || 
               contact.contactCompany?.id === selectedCompanyId ||
               contact.companies?.id === selectedCompanyId;
      });
    } else if (filterType === 'stage') {
      if (selectedPipeline && selectedPipeline !== 'all') {
        filtered = filtered.filter((contact) => {
          const pipeline = contact.pipelines || contact.pipeline;
          return pipeline?.pipeline === selectedPipeline;
        });
      }
      if (selectedStage && selectedStage !== 'all') {
        filtered = filtered.filter((contact) => {
          const pipeline = contact.pipelines || contact.pipeline;
          return pipeline?.stage === selectedStage;
        });
      }
    }

    return filtered;
  }, [contacts, filterType, selectedCompanyId, selectedPipeline, selectedStage]);

  // Filter contacts with search applied (for display)
  const filteredContacts = useMemo(() => {
    let filtered = [...qualifyingContacts];

    // Apply search query (works for all filter types)
    if (searchTerm && searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((contact) => {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const companyName = (contact.companies?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
        return (
          fullName.includes(query) ||
          email.includes(query) ||
          companyName.includes(query)
        );
      });
    }

    return filtered;
  }, [qualifyingContacts, searchTerm]);

  // Auto-select all qualifying contacts if selectAll param is true (ignore search term)
  useEffect(() => {
    if (selectAllParam && hydrated && qualifyingContacts.length > 0 && selectedContacts.size === 0) {
      // Select all contacts that qualify for the filter (not just what's visible in search)
      setSelectedContacts(new Set(qualifyingContacts.map((c) => c.id)));
    }
  }, [selectAllParam, hydrated, qualifyingContacts, selectedContacts.size]);

  const handleToggleContact = (contactId) => {
    setSelectedContacts((prev) => {
      const updated = new Set(prev);
      if (updated.has(contactId)) {
        updated.delete(contactId);
      } else {
        updated.add(contactId);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleCreateList = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select at least one contact.');
      return;
    }
    if (!listName.trim()) {
      alert('Please enter a list name.');
      setError('List name is required');
      return;
    }

    if (!companyHQId) {
      alert('Company HQ ID not found. Please refresh the page.');
      setError('Company HQ ID not found');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // If selectAll was used, use all qualifying contacts; otherwise use selected contacts
      const contactIds = selectAllParam && selectedContacts.size === qualifyingContacts.length
        ? Array.from(qualifyingContacts.map(c => c.id))
        : Array.from(selectedContacts);
      
      if (!ownerId) {
        setError('Owner ID not found. Please refresh the page.');
        setIsCreating(false);
        return;
      }

      const response = await api.post('/api/contact-lists', {
        ownerId, // ownerId from localStorage
        companyHQId: companyHQId || undefined, // Optional, will be resolved from owner if not provided
        title: listName.trim(), // Use 'title' like templates (maps to 'name' in schema)
        description: listDescription.trim() || undefined,
        contactIds,
        // Store filter info in filters if needed (or we can add campaignId later)
        ...(filterType !== 'all' && {
          filters: {
            filterType,
            ...(filterType === 'company' && selectedCompanyId && { companyId: selectedCompanyId }),
            ...(filterType === 'stage' && selectedPipeline && selectedPipeline !== 'all' && { pipeline: selectedPipeline }),
            ...(filterType === 'stage' && selectedStage && selectedStage !== 'all' && { stage: selectedStage }),
          },
        }),
      });

      if (response.data?.success && response.data.list) {
        const createdList = response.data.list;
        addList(createdList);
        setIsCreating(false);
        setError(null);
        
        // Redirect to success page with list details
        const params = new URLSearchParams({
          listId: createdList.id,
          listName: createdList.title || createdList.name || listName.trim(),
          contactCount: String(createdList.totalContacts || selectedContacts.size || 0),
        });
        if (returnTo) {
          params.append('returnTo', returnTo);
        }
        router.push(`/contacts/list-builder/success?${params.toString()}`);
      } else {
        setError(response.data?.error || 'Failed to create list');
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Error creating list:', err);
      setError(err.response?.data?.error || 'Failed to create list');
      setIsCreating(false);
    }
  };

  const getAvailableStages = () => {
    if (!selectedPipeline || selectedPipeline === 'all') return [];
    return PIPELINE_STAGES[selectedPipeline] || [];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Contact List"
          subtitle="Name your list and select contacts"
          backTo="/contacts/list-builder"
          backLabel="Back to Filters"
        />

        {/* List Details - MOVED TO TOP */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg border-2 border-indigo-200">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">List Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                List Name *
              </label>
              <input
                type="text"
                value={listName}
                onChange={(e) => {
                  setListName(e.target.value);
                  setError(null); // Clear error when typing
                }}
                className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                  !listName.trim() && selectedContacts.size > 0
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
                placeholder="Enter list name"
                required
                autoFocus
              />
              {!listName.trim() && (
                <p className="mt-1 text-sm text-gray-500">Give your list a name to continue</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <input
                type="text"
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe this list"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search - always available - inline typing filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={filterType === 'all' ? 'Type to search all contacts...' : 'Type to search filtered contacts...'}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Company Filter - only for company filter type */}
            {filterType === 'company' && (
              <div>
                <CompanySelector
                  companyId={selectedCompanyId}
                  onCompanyChange={(company) => {
                    setSelectedCompanyId(company?.id || '');
                    setSelectedContacts(new Set()); // Reset selection when company changes
                  }}
                />
              </div>
            )}

            {/* Pipeline Filter - only for stage filter type */}
            {filterType === 'stage' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Pipeline
                  </label>
                  <select
                    value={selectedPipeline}
                    onChange={(e) => {
                      setSelectedPipeline(e.target.value);
                      setSelectedStage(''); // Reset stage when pipeline changes
                      setSelectedContacts(new Set());
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Pipelines</option>
                    {OFFICIAL_PIPELINES.map((pipeline) => (
                      <option key={pipeline} value={pipeline}>
                        {pipeline.charAt(0).toUpperCase() + pipeline.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedPipeline && selectedPipeline !== 'all' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Stage
                    </label>
                    <select
                      value={selectedStage}
                      onChange={(e) => {
                        setSelectedStage(e.target.value);
                        setSelectedContacts(new Set());
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Stages</option>
                      {getAvailableStages().map((stage) => (
                        <option key={stage} value={stage}>
                          {stage.charAt(0).toUpperCase() + stage.slice(1).replace(/-/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Info for "all" filter type */}
            {filterType === 'all' && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">All Contacts</p>
                  <p className="text-xs text-blue-700">Select which contacts to include in your list</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contacts Preview */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Select Contacts ({selectedContacts.size} selected{selectAllParam && selectedContacts.size > 0 ? ` of ${qualifyingContacts.length}` : ''})
              </h3>
              <p className="text-sm text-gray-600">
                {searchTerm.trim() 
                  ? `${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''} match your search`
                  : `${qualifyingContacts.length} contact${qualifyingContacts.length !== 1 ? 's' : ''} available`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectAll}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              {selectedContacts.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {!hydrated ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600">
                {searchTerm.trim() 
                  ? 'No contacts match your search. Try a different query.' 
                  : 'No contacts match your filters.'}
              </p>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContacts.has(contact.id);
                const pipeline = contact.pipelines || contact.pipeline;
                const company = contact.companies || contact.contactCompany;
                
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleToggleContact(contact.id)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {contact.email}
                        </div>
                        {company && (
                          <div className="mt-1 text-xs text-gray-500">
                            {company.companyName}
                          </div>
                        )}
                        {pipeline && (
                          <div className="mt-1 flex gap-2">
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                              {pipeline.pipeline}
                            </span>
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
                              {pipeline.stage}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/contacts/list-builder')}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-2 font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleCreateList}
            disabled={selectedContacts.size === 0 || !listName.trim() || isCreating}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isCreating ? 'Creating...' : `Create List (${selectedContacts.size} contacts)`}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContactListPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ContactListPreviewContent />
    </Suspense>
  );
}

