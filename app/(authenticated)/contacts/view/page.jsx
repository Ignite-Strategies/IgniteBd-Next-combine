'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Filter,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Building2,
  X,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import EnrichmentModal from '@/components/enrichment/EnrichmentModal';
import CompanySelector from '@/components/CompanySelector';

export default function ContactsViewPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [enrichmentFilter, setEnrichmentFilter] = useState(''); // 'enriched' | 'not-enriched' | ''
  const [scoreFilter, setScoreFilter] = useState(''); // 'buyingPower' | 'readiness' | 'urgency' | 'momentum' | ''
  const [scoreMin, setScoreMin] = useState(75); // Minimum score for filter
  const [companyHealthFilter, setCompanyHealthFilter] = useState(''); // 'high' | 'medium' | 'low' | ''
  const [deletingId, setDeletingId] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [enrichmentModalContactId, setEnrichmentModalContactId] = useState(null);
  const [assigningCompanyId, setAssigningCompanyId] = useState(null);
  const [selectedCompanyForAssign, setSelectedCompanyForAssign] = useState(null);
  const [savingCompanyAssignment, setSavingCompanyAssignment] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  const refreshContactsFromAPI = useCallback(
    async (showLoading = true) => {
      if (!companyHQId) return;

      try {
        if (showLoading) setLoading(true);
        const params = new URLSearchParams({ companyHQId });
        if (pipelineFilter) {
          params.append('pipeline', pipelineFilter);
        }
        const response = await api.get(`/api/contacts?${params.toString()}`);

        if (response.data?.success && response.data.contacts) {
          const fetchedContacts = response.data.contacts;
          setContacts(fetchedContacts);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              'contacts',
              JSON.stringify(fetchedContacts),
            );
          }
        } else {
          setContacts([]);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        if (showLoading) setContacts([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [companyHQId, pipelineFilter],
  );

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // Only load from localStorage
    const cachedContacts = window.localStorage.getItem('contacts');
    if (cachedContacts) {
      try {
        const parsed = JSON.parse(cachedContacts);
        setContacts(parsed);
      } catch (error) {
        console.warn('Unable to parse cached contacts', error);
      }
    }
    setLoading(false);
  }, []);

  const handleSelectContact = (contactId) => {
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

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (
        pipelineFilter &&
        (contact.pipelines?.pipeline || contact.pipeline?.pipeline) !== pipelineFilter
      ) {
        return false;
      }

      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const name = `${contact.firstName || ''} ${
        contact.lastName || ''
      }`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (
        contact.companies?.companyName || 
        contact.contactCompany?.companyName || 
        ''
      ).toLowerCase();
      return (
        name.includes(search) ||
        email.includes(search) ||
        company.includes(search)
      );
    });
  }, [contacts, pipelineFilter, searchTerm]);

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    const count = selectedContacts.size;
    if (
      !window.confirm(
        `Are you sure you want to delete ${count} contact${
          count !== 1 ? 's' : ''
        }?`,
      )
    ) {
      return;
    }

    try {
      setBulkDeleting(true);
      await Promise.all(
        Array.from(selectedContacts).map((contactId) =>
          api.delete(`/api/contacts/${contactId}`),
        ),
      );

      const updatedContacts = contacts.filter(
        (contact) => !selectedContacts.has(contact.id),
      );
      setContacts(updatedContacts);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'contacts',
          JSON.stringify(updatedContacts),
        );
      }
      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      alert('Failed to delete some contacts. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDelete = async (contactId, event) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setDeletingId(contactId);
      await api.delete(`/api/contacts/${contactId}`);
      const updatedContacts = contacts.filter((c) => c.id !== contactId);
      setContacts(updatedContacts);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'contacts',
          JSON.stringify(updatedContacts),
        );
      }
      setSelectedContacts((prev) => {
        const updated = new Set(prev);
        updated.delete(contactId);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatLabel = (value) =>
    value
      ? value
          .split(/[-_]/)
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(' ')
      : '';

  const getPipelineBadge = (contact) => {
    const pipeline = contact.pipelines || contact.pipeline;
    if (!pipeline) return null;
    const colors = {
      prospect: 'bg-blue-100 text-blue-800',
      client: 'bg-green-100 text-green-800',
      collaborator: 'bg-purple-100 text-purple-800',
      institution: 'bg-orange-100 text-orange-800',
    };
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-semibold ${
          colors[pipeline.pipeline] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {formatLabel(pipeline.pipeline)}
      </span>
    );
  };

  const getStageBadge = (contact) => {
    const pipeline = contact.pipelines || contact.pipeline;
    if (!pipeline?.stage) return null;
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {formatLabel(pipeline.stage)}
      </span>
    );
  };

  const getIntelligenceBadges = (contact) => {
    const badges = [];
    
    if (contact.buyingPowerScore !== null && contact.buyingPowerScore > 75) {
      badges.push(
        <span
          key="buying-power"
          className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800"
          title={`Buying Power: ${contact.buyingPowerScore}/100`}
        >
          High Buyer Power
        </span>
      );
    }
    
    if (contact.readinessToBuyScore !== null && contact.readinessToBuyScore > 75) {
      badges.push(
        <span
          key="readiness"
          className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
          title={`Readiness: ${contact.readinessToBuyScore}/100`}
        >
          High Readiness
        </span>
      );
    }
    
    if (contact.urgencyScore !== null && contact.urgencyScore > 75) {
      badges.push(
        <span
          key="urgency"
          className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"
          title={`Urgency: ${contact.urgencyScore}/100`}
        >
          High Urgency
        </span>
      );
    }
    
    if (contact.careerMomentumScore !== null && contact.careerMomentumScore > 75) {
      badges.push(
        <span
          key="momentum"
          className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"
          title={`Career Momentum: ${contact.careerMomentumScore}/100`}
        >
          Fast Career Momentum
        </span>
      );
    }
    
    return badges;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">
            Loading Contacts…
          </div>
          <div className="text-gray-600">Fetching your contacts…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👥 All Contacts</h1>
              <p className="mt-2 text-gray-600">
                {filteredContacts.length} contact
                {filteredContacts.length !== 1 ? 's' : ''} • {contacts.length}{' '}
                total
              </p>
            </div>
            <div className="flex gap-3">
              {selectedContacts.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                    bulkDeleting
                      ? 'cursor-not-allowed bg-gray-400 text-white'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="h-5 w-5" />
                  Delete {selectedContacts.size}
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!companyHQId) {
                    alert('Company context required. Please set your company first.');
                    return;
                  }
                  setSyncing(true);
                  try {
                    // Use hydrate route for complete refresh
                    const response = await api.post('/api/contacts/hydrate', {
                      companyHQId,
                    });
                    if (response.data?.success && Array.isArray(response.data.contacts)) {
                      const hydratedContacts = response.data.contacts;
                      setContacts(hydratedContacts);
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('contacts', JSON.stringify(hydratedContacts));
                      }
                      console.log(`✅ Synced ${hydratedContacts.length} contacts`);
                    } else {
                      // Fallback to regular refresh
                      await refreshContactsFromAPI(true);
                    }
                  } catch (error) {
                    console.error('Error syncing contacts:', error);
                    // Fallback to regular refresh
                    await refreshContactsFromAPI(true);
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing || !companyHQId}
                className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/contacts')}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700"
              >
                ← Back to People Hub
              </button>
              <button
                type="button"
                onClick={() => router.push('/contacts/manual')}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                Add Contact
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <select
                  value={pipelineFilter}
                  onChange={(event) => setPipelineFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Pipelines</option>
                  <option value="prospect">Prospect</option>
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
              <div className="relative">
                <select
                  value={enrichmentFilter}
                  onChange={(event) => setEnrichmentFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Contacts</option>
                  <option value="enriched">Enriched</option>
                  <option value="not-enriched">Not Enriched</option>
                </select>
              </div>
              <div className="relative">
                <select
                  value={scoreFilter}
                  onChange={(event) => setScoreFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Scores</option>
                  <option value="buyingPower">Buying Power &gt; {scoreMin}</option>
                  <option value="readiness">Readiness &gt; {scoreMin}</option>
                  <option value="urgency">Urgency &gt; {scoreMin}</option>
                  <option value="momentum">Career Momentum &gt; {scoreMin}</option>
                </select>
              </div>
              <div className="relative">
                <select
                  value={companyHealthFilter}
                  onChange={(event) => setCompanyHealthFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Company Health</option>
                  <option value="high">High Health (75+)</option>
                  <option value="medium">Medium Health (50-74)</option>
                  <option value="low">Low Health (&lt;50)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              No contacts found
            </h3>
            <p className="mb-6 text-gray-600">
              {searchTerm || pipelineFilter
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first contact.'}
            </p>
            {!searchTerm && !pipelineFilter && (
              <button
                type="button"
                onClick={() => router.push('/contacts/manual')}
                className="rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
              >
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900">
                Contacts ({filteredContacts.length})
              </h2>
              {selectedContacts.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedContacts.size} selected
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          filteredContacts.length > 0 &&
                          selectedContacts.size === filteredContacts.length
                        }
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Intelligence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pipeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                    >
                      <td
                        className="px-6 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="hover:text-blue-600 hover:underline">
                            {contact.goesBy ||
                              `${contact.firstName || ''} ${
                                contact.lastName || ''
                              }`.trim() ||
                              'Unnamed Contact'}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {getIntelligenceBadges(contact)}
                          </div>
                        </div>
                        {contact.title && (
                          <div className="mt-1 text-xs text-gray-400">
                            {contact.title}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {contact.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {contact.phone || 'N/A'}
                      </td>
                      <td 
                        className="px-6 py-4 text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <span>
                            {contact.companies?.companyName || 
                             contact.company?.companyName || 
                             contact.contactCompany?.companyName || 
                             contact.companyName || 
                             'N/A'}
                          </span>
                          {/* Show health score if company exists, even if score is 0 */}
                          {contact.companies && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                (contact.companies.companyHealthScore ?? 0) >= 75
                                  ? 'bg-green-100 text-green-800'
                                  : (contact.companies.companyHealthScore ?? 0) >= 50
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                              title={`Company Health: ${contact.companies.companyHealthScore ?? 0}/100`}
                            >
                              {contact.companies.companyHealthScore ?? 0}
                            </span>
                          )}
                          {!contact.companies && contact.company && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                (contact.company.companyHealthScore ?? 0) >= 75
                                  ? 'bg-green-100 text-green-800'
                                  : (contact.company.companyHealthScore ?? 0) >= 50
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                              title={`Company Health: ${contact.company.companyHealthScore ?? 0}/100`}
                            >
                              {contact.company.companyHealthScore ?? 0}
                            </span>
                          )}
                          {assigningCompanyId === contact.id ? (
                            <div className="flex items-center gap-1">
                              <CompanySelector
                                companyId={contact.companies?.id || contact.company?.id || contact.contactCompany?.id || null}
                                selectedCompany={selectedCompanyForAssign}
                                onCompanySelect={(company) => setSelectedCompanyForAssign(company)}
                                showLabel={false}
                                className="w-48"
                                placeholder="Search company..."
                              />
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!selectedCompanyForAssign) {
                                    alert('Please select a company');
                                    return;
                                  }
                                  setSavingCompanyAssignment(true);
                                  try {
                                    const response = await api.put(`/api/contacts/${contact.id}`, {
                                      contactCompanyId: selectedCompanyForAssign.id,
                                      companyId: selectedCompanyForAssign.id,
                                    });
                                    if (response.data?.success) {
                                      const updatedContact = response.data.contact;
                                      // Update local state
                                      const updatedContacts = contacts.map((c) =>
                                        c.id === contact.id ? updatedContact : c
                                      );
                                      setContacts(updatedContacts);
                                      // Update localStorage immediately
                                      if (typeof window !== 'undefined') {
                                        window.localStorage.setItem('contacts', JSON.stringify(updatedContacts));
                                      }
                                      setAssigningCompanyId(null);
                                      setSelectedCompanyForAssign(null);
                                      console.log('✅ Company assigned and localStorage updated');
                                    } else {
                                      alert(response.data?.error || 'Failed to assign company');
                                    }
                                  } catch (error) {
                                    console.error('Error assigning company:', error);
                                    alert(error.response?.data?.error || 'Failed to assign company');
                                  } finally {
                                    setSavingCompanyAssignment(false);
                                  }
                                }}
                                disabled={savingCompanyAssignment || !selectedCompanyForAssign}
                                className="rounded-lg p-1 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningCompanyId(null);
                                  setSelectedCompanyForAssign(null);
                                }}
                                className="rounded-lg p-1 bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
                                title="Cancel"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningCompanyId(contact.id);
                                setSelectedCompanyForAssign(contact.companies || contact.company || contact.contactCompany || null);
                              }}
                              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition"
                              title="Assign company"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {contact.buyingPowerScore !== null && (
                            <span
                              className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                              title={`Buying Power: ${contact.buyingPowerScore}/100`}
                            >
                              BP: {contact.buyingPowerScore}
                            </span>
                          )}
                          {contact.readinessToBuyScore !== null && (
                            <span
                              className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                              title={`Readiness: ${contact.readinessToBuyScore}/100`}
                            >
                              R: {contact.readinessToBuyScore}
                            </span>
                          )}
                          {contact.urgencyScore !== null && (
                            <span
                              className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
                              title={`Urgency: ${contact.urgencyScore}/100`}
                            >
                              U: {contact.urgencyScore}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getPipelineBadge(contact)}</td>
                      <td className="px-6 py-4">{getStageBadge(contact)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEnrichmentModalContactId(contact.id);
                            }}
                            className="rounded-lg p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                            title="Enrich contact"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => handleDelete(contact.id, event)}
                            disabled={deletingId === contact.id}
                            className={`rounded-lg p-2 transition ${
                              deletingId === contact.id
                                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                            title="Delete contact"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Enrichment Modal */}
        {enrichmentModalContactId && (
          <EnrichmentModal
            isOpen={!!enrichmentModalContactId}
            onClose={() => setEnrichmentModalContactId(null)}
            contactId={enrichmentModalContactId}
            onEnrichmentSaved={() => {
              refreshContactsFromAPI(true);
              setEnrichmentModalContactId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

