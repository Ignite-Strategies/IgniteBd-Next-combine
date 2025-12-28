'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Building2, Filter, X } from 'lucide-react';
import api from '@/lib/api';
import { PIPELINE_STAGES, OFFICIAL_PIPELINES } from '@/lib/config/pipelineConfig';

export default function BuildFromContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [companyHQId, setCompanyHQId] = useState('');

  // Load companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') || '';
    setCompanyHQId(stored);
  }, []);

  // Fetch contacts
  useEffect(() => {
    if (!companyHQId) return;

    const fetchContacts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        if (response.data?.success && Array.isArray(response.data.contacts)) {
          setContacts(response.data.contacts);
        } else {
          setError('Failed to load contacts');
        }
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
        setError(err.response?.data?.error || 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [companyHQId]);

  // Get available stages for selected pipeline
  const availableStages = useMemo(() => {
    if (selectedPipeline === 'all') return [];
    return PIPELINE_STAGES[selectedPipeline] || [];
  }, [selectedPipeline]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Pipeline filter
    if (selectedPipeline !== 'all') {
      filtered = filtered.filter((contact) => {
        if (!contact.pipeline) return false;
        return contact.pipeline.pipeline === selectedPipeline;
      });
    }

    // Stage filter
    if (selectedStage !== 'all') {
      filtered = filtered.filter((contact) => {
        if (!contact.pipeline) return false;
        return contact.pipeline.stage === selectedStage;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contact) => {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const companyName = (contact.company?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
        const title = (contact.title || '').toLowerCase();
        
        return (
          fullName.includes(query) ||
          email.includes(query) ||
          companyName.includes(query) ||
          title.includes(query)
        );
      });
    }

    return filtered;
  }, [contacts, selectedPipeline, selectedStage, searchQuery]);

  const handleContactSelect = (contactId) => {
    router.push(`/personas/from-contact?contactId=${contactId}`);
  };

  const getPipelineBadgeColor = (pipeline) => {
    switch (pipeline) {
      case 'prospect':
        return 'bg-blue-100 text-blue-800';
      case 'client':
        return 'bg-green-100 text-green-800';
      case 'collaborator':
        return 'bg-purple-100 text-purple-800';
      case 'institution':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageBadgeColor = (stage) => {
    return 'bg-gray-100 text-gray-700';
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Company context is required. Please set companyHQId in localStorage.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Personas
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Build from Contacts</h1>
          <p className="mt-2 text-gray-600">
            Select a contact to generate a persona. Works with any contact (prospects or clients).
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Pipeline Filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Pipeline
              </label>
              <select
                value={selectedPipeline}
                onChange={(e) => {
                  setSelectedPipeline(e.target.value);
                  setSelectedStage('all'); // Reset stage when pipeline changes
                }}
                className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="all">All Pipelines</option>
                {OFFICIAL_PIPELINES.map((pipeline) => (
                  <option key={pipeline} value={pipeline}>
                    {pipeline.charAt(0).toUpperCase() + pipeline.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                disabled={selectedPipeline === 'all' || availableStages.length === 0}
                className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="all">All Stages</option>
                {availableStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1).replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(selectedPipeline !== 'all' || selectedStage !== 'all' || searchQuery) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedPipeline('all');
                    setSelectedStage('all');
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading contacts...</p>
          </div>
        )}

        {/* Contacts List */}
        {!loading && !error && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {filteredContacts.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-lg font-semibold text-gray-900">No contacts found</p>
                <p className="mt-2 text-sm text-gray-600">
                  {searchQuery || selectedPipeline !== 'all' || selectedStage !== 'all'
                    ? 'Try adjusting your filters or search query'
                    : 'No contacts available. Create contacts first.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredContacts.map((contact) => {
                  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
                  const companyName = contact.company?.companyName || contact.contactCompany?.companyName || 'No Company';
                  const pipeline = contact.pipeline?.pipeline || null;
                  const stage = contact.pipeline?.stage || null;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleContactSelect(contact.id)}
                      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
                    >
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                        {contact.title && (
                          <p className="text-sm text-gray-600">{contact.title}</p>
                        )}
                      </div>

                      <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                        <Building2 className="h-4 w-4" />
                        <span className="truncate">{companyName}</span>
                      </div>

                      {contact.email && (
                        <p className="mb-3 text-xs text-gray-500">{contact.email}</p>
                      )}

                      {/* Pipeline & Stage Badges */}
                      <div className="flex flex-wrap gap-2">
                        {pipeline && (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPipelineBadgeColor(pipeline)}`}
                          >
                            {pipeline}
                          </span>
                        )}
                        {stage && (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStageBadgeColor(stage)}`}
                          >
                            {stage.replace(/-/g, ' ')}
                          </span>
                        )}
                        {!pipeline && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                            No Pipeline
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

