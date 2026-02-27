'use client';

import { useCallback, useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Filter,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  X,
  Check,
  Edit2,
  Copy,
  CheckCheck,
  Loader2,
  Download,
  CalendarClock,
} from 'lucide-react';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import CompanySelector from '@/components/CompanySelector';
import { formatDateEST } from '@/lib/dateEst';

function ContactsViewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name-asc' | 'name-desc'
  const [recentlyAddedOnly, setRecentlyAddedOnly] = useState(false); // last 7 days
  const [deletingId, setDeletingId] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gettingEmails, setGettingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState({ current: 0, total: 0 });
  const [emailModal, setEmailModal] = useState(null); // { results: [...], emails: [...] }
  const [copied, setCopied] = useState(false);
  const [assigningCompanyId, setAssigningCompanyId] = useState(null);
  const [selectedCompanyForAssign, setSelectedCompanyForAssign] = useState(null);
  const [savingCompanyAssignment, setSavingCompanyAssignment] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showBulkNextEngagement, setShowBulkNextEngagement] = useState(false);
  const [bulkNextEngagementDate, setBulkNextEngagementDate] = useState('');
  const [bulkNextEngagementPurpose, setBulkNextEngagementPurpose] = useState('');
  const [savingBulkNextEngagement, setSavingBulkNextEngagement] = useState(false);
  const lastValidatedCompanyHQId = useRef(null);

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/contacts/view?companyHQId=${stored}`);
      } else {
        router.push('/people');
      }
    }
  }, [companyHQId, router]);

  const refreshContactsFromAPI = useCallback(
    async (showLoading = true) => {
      if (!companyHQId) {
        console.log('⚠️ No companyHQId - skipping contact fetch');
        return;
      }

      try {
        if (showLoading) setLoading(true);
        const params = new URLSearchParams({ companyHQId });
        if (pipelineFilter) {
          params.append('pipeline', pipelineFilter);
        }
        
        console.log('📞 Fetching contacts from API:', {
          companyHQId,
          pipelineFilter: pipelineFilter || 'all',
          url: `/api/contacts?${params.toString()}`,
        });
        
        const response = await api.get(`/api/contacts?${params.toString()}`);

        if (response.data?.success && response.data.contacts) {
          const fetchedContacts = response.data.contacts;
          console.log(`✅ Fetched ${fetchedContacts.length} contacts for CompanyHQ: ${companyHQId}`);
          setContacts(fetchedContacts);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              'contacts',
              JSON.stringify(fetchedContacts),
            );
          }
        } else {
          console.warn('⚠️ API response missing contacts:', response.data);
          setContacts([]);
        }
      } catch (error) {
        console.error('❌ Error fetching contacts:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          companyHQId,
        });
        if (showLoading) setContacts([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [companyHQId, pipelineFilter],
  );

  // NO localStorage - always fetch from API when companyHQId changes
  useEffect(() => {
    if (!companyHQId) {
      setLoading(false);
      setContacts([]);
      lastValidatedCompanyHQId.current = null;
      return;
    }

    // Skip if we've already fetched for this companyHQId
    if (lastValidatedCompanyHQId.current === companyHQId) {
      return;
    }

    // Always fetch from API - no localStorage cache
    console.log('🔄 Fetching contacts from API:', {
      companyHQId,
      timestamp: new Date().toISOString(),
    });
    lastValidatedCompanyHQId.current = companyHQId;
    refreshContactsFromAPI(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyHQId]); // Only depend on companyHQId - refreshContactsFromAPI is stable within its useCallback

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

  const handleBulkSetNextEngagement = async () => {
    const ids = Array.from(selectedContacts);
    if (ids.length === 0) return;
    const dateStr = bulkNextEngagementDate?.trim() || null;
    const purpose = bulkNextEngagementPurpose?.trim() || null;
    if (!dateStr && !purpose) {
      alert('Set at least a date or purpose.');
      return;
    }
    if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      alert('Date must be YYYY-MM-DD.');
      return;
    }
    setSavingBulkNextEngagement(true);
    try {
      let ok = 0;
      let err = 0;
      for (const contactId of ids) {
        try {
          await api.patch(`/api/contacts/${contactId}/next-engagement`, {
            ...(dateStr && { nextEngagementDate: dateStr }),
            ...(purpose && { nextEngagementPurpose: purpose }),
          });
          ok++;
        } catch (e) {
          err++;
        }
      }
      setShowBulkNextEngagement(false);
      setBulkNextEngagementDate('');
      setBulkNextEngagementPurpose('');
      setSelectedContacts(new Set());
      await refreshContactsFromAPI(false);
      if (err > 0) {
        alert(`Updated ${ok} contact(s). ${err} failed.`);
      }
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'Update failed');
    } finally {
      setSavingBulkNextEngagement(false);
    }
  };

  const handleDownloadContacts = async () => {
    if (!companyHQId) {
      alert('Company context required. Please select a company first.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to download contacts.');
      return;
    }
    setDownloading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/contacts/export?companyHQId=${encodeURIComponent(companyHQId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_export_${companyHQId.slice(0, 8)}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let list = contacts.filter((contact) => {
      if (
        pipelineFilter &&
        (contact.pipelines?.pipeline || contact.pipeline?.pipeline) !== pipelineFilter
      ) {
        return false;
      }
      if (recentlyAddedOnly && contact.createdAt) {
        const created = new Date(contact.createdAt);
        if (created < sevenDaysAgo) return false;
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

    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'newest') {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      }
      if (sortBy === 'oldest') {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
      }
      const nameA = `${(a.firstName || '').toLowerCase()} ${(a.lastName || '').toLowerCase()}`.trim();
      const nameB = `${(b.firstName || '').toLowerCase()} ${(b.lastName || '').toLowerCase()}`.trim();
      if (sortBy === 'name-asc') return nameA.localeCompare(nameB);
      if (sortBy === 'name-desc') return nameB.localeCompare(nameA);
      return 0;
    });
    return sorted;
  }, [contacts, pipelineFilter, searchTerm, sortBy, recentlyAddedOnly]);

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

  const handleGetEmails = async () => {
    if (selectedContacts.size === 0) return;

    const selected = filteredContacts.filter((c) => selectedContacts.has(c.id));
    const withEmail = selected.filter((c) => c.email);
    const needsEnrich = selected.filter((c) => !c.email && c.linkedinUrl);
    const noData = selected.filter((c) => !c.email && !c.linkedinUrl);

    setGettingEmails(true);
    setEmailProgress({ current: 0, total: needsEnrich.length });

    const results = [];

    // Include contacts that already have emails
    for (const c of withEmail) {
      results.push({
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
        email: c.email,
        status: 'existing',
      });
    }

    // Enrich contacts without emails via Apollo
    for (let i = 0; i < needsEnrich.length; i++) {
      const c = needsEnrich[i];
      setEmailProgress({ current: i + 1, total: needsEnrich.length });
      try {
        const response = await api.post('/api/contacts/bulk-enrich', {
          contactId: c.id,
          linkedinUrl: c.linkedinUrl,
          companyHQId,
        });
        const email = response.data?.email || null;
        const emailAlreadyExists = response.data?.emailAlreadyExists === true;
        if (email) {
          // Update local state so table reflects new email
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === c.id ? { ...contact, email } : contact,
            ),
          );
        }
        results.push({
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
          email: emailAlreadyExists ? null : email,
          status: emailAlreadyExists ? 'duplicate' : (email ? 'enriched' : 'not-found'),
        });
      } catch {
        results.push({
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
          email: null,
          status: 'error',
        });
      }
    }

    // Contacts with no email and no LinkedIn
    for (const c of noData) {
      results.push({
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
        email: null,
        status: 'no-linkedin',
      });
    }

    const emails = results.filter((r) => r.email).map((r) => r.email);
    setEmailModal({ results, emails });
    setGettingEmails(false);
    setEmailProgress({ current: 0, total: 0 });
  };

  const handleCopyEmails = async () => {
    if (!emailModal?.emails?.length) return;
    await navigator.clipboard.writeText(emailModal.emails.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      unassigned: 'bg-gray-100 text-gray-700',
      connector: 'bg-amber-100 text-amber-800',
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
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkNextEngagement(true)}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                    title="Set or correct next engagement date/purpose for selected contacts"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Set next engagement ({selectedContacts.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleGetEmails}
                    disabled={gettingEmails}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition ${
                      gettingEmails
                        ? 'cursor-not-allowed bg-green-400 text-white'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {gettingEmails ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {emailProgress.total > 0
                          ? `Enriching ${emailProgress.current}/${emailProgress.total}…`
                          : 'Getting Emails…'}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Get Emails ({selectedContacts.size})
                      </>
                    )}
                  </button>
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
                </>
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
                      // NO localStorage - API only
                      console.log(`✅ Synced ${hydratedContacts.length} contacts from API`);
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
                onClick={handleDownloadContacts}
                disabled={downloading || !companyHQId}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download contacts as CSV (see what's there, re-upload to update)"
              >
                <Download className="h-5 w-5" />
                {downloading ? 'Downloading…' : 'Download CSV'}
              </button>
              <button
                type="button"
                onClick={() => router.push(companyHQId ? `/growth-dashboard?companyHQId=${companyHQId}` : '/growth-dashboard')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.push(companyHQId ? `/people?companyHQId=${companyHQId}` : '/people')}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700"
              >
                ← Back to People Hub
              </button>
              <button
                type="button"
                onClick={() => router.push(companyHQId ? `/people/load?companyHQId=${companyHQId}` : '/people/load')}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                Add Contact
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
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
                  <option value="unassigned">Unassigned</option>
                  <option value="connector">Connector</option>
                  <option value="prospect">Prospect</option>
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  title="Sort order"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={recentlyAddedOnly}
                  onChange={(event) => setRecentlyAddedOnly(event.target.checked)}
                  className="rounded border-gray-300"
                />
                Recently added (7 days)
              </label>
            </div>
          </div>
        </div>

        {/* Bulk set next engagement modal */}
        {showBulkNextEngagement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h2 className="text-lg font-bold text-gray-900">Set next engagement</h2>
                <button
                  type="button"
                  onClick={() => !savingBulkNextEngagement && (setShowBulkNextEngagement(false), setBulkNextEngagementDate(''), setBulkNextEngagementPurpose(''))}
                  disabled={savingBulkNextEngagement}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <p className="text-sm text-gray-600">
                  Set date and/or purpose for <strong>{selectedContacts.size}</strong> selected contact{selectedContacts.size !== 1 ? 's' : ''}. Leave blank to leave unchanged.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={bulkNextEngagementDate}
                    onChange={(e) => setBulkNextEngagementDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Purpose</label>
                  <select
                    value={bulkNextEngagementPurpose}
                    onChange={(e) => setBulkNextEngagementPurpose(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Leave unchanged —</option>
                    <option value="GENERAL_CHECK_IN">General check-in</option>
                    <option value="UNRESPONSIVE">Unresponsive</option>
                    <option value="PERIODIC_CHECK_IN">Periodic check-in</option>
                    <option value="REFERRAL_NO_CONTACT">Referral (no contact)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
                <button
                  type="button"
                  onClick={() => !savingBulkNextEngagement && (setShowBulkNextEngagement(false), setBulkNextEngagementDate(''), setBulkNextEngagementPurpose(''))}
                  disabled={savingBulkNextEngagement}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSetNextEngagement}
                  disabled={savingBulkNextEngagement || (!bulkNextEngagementDate?.trim() && !bulkNextEngagementPurpose?.trim())}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingBulkNextEngagement ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Set for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
                onClick={() => router.push('/people/load')}
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
                    <th className="max-w-[11rem] px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pipeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Next engagement
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
                      onClick={() => router.push(`/contacts/${contact.id}${companyHQId ? `?companyHQId=${companyHQId}` : ''}`)}
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
                        <div>
                          <span className="hover:text-blue-600 hover:underline">
                            {contact.goesBy ||
                              `${contact.firstName || ''} ${
                                contact.lastName || ''
                              }`.trim() ||
                              'Unnamed Contact'}
                          </span>
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
                        className="max-w-[11rem] whitespace-nowrap px-3 py-4 text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                        title={contact.companies?.companyName || contact.company?.companyName || contact.contactCompany?.companyName || contact.companyName || ''}
                      >
                        <div className="flex items-center gap-2">
                          <span className="block truncate">
                            {contact.companies?.companyName || 
                             contact.company?.companyName || 
                             contact.contactCompany?.companyName || 
                             contact.companyName || 
                             'N/A'}
                          </span>
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
                                      // NO localStorage - API only
                                      setAssigningCompanyId(null);
                                      setSelectedCompanyForAssign(null);
                                      console.log('✅ Company assigned');
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
                      <td className="px-6 py-4">{getPipelineBadge(contact)}</td>
                      <td className="px-6 py-4">{getStageBadge(contact)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {contact.nextEngagementDate ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                            {formatDateEST(contact.nextEngagementDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                            {contact.nextEngagementPurpose && (
                              <span className="ml-1 text-amber-600">
                                · {contact.nextEngagementPurpose === 'GENERAL_CHECK_IN' && 'General check-in'}
                                {contact.nextEngagementPurpose === 'UNRESPONSIVE' && 'Unresponsive'}
                                {contact.nextEngagementPurpose === 'PERIODIC_CHECK_IN' && 'Periodic check-in'}
                                {contact.nextEngagementPurpose === 'REFERRAL_NO_CONTACT' && 'Referral (no contact)'}
                                {!['GENERAL_CHECK_IN', 'UNRESPONSIVE', 'PERIODIC_CHECK_IN', 'REFERRAL_NO_CONTACT'].includes(contact.nextEngagementPurpose) && contact.nextEngagementPurpose}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/contacts/${contact.id}${companyHQId ? `?companyHQId=${companyHQId}` : ''}`);
                            }}
                            className="rounded-lg p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                            title="View contact details"
                          >
                            <Edit2 className="h-4 w-4" />
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
      </div>

      {/* Email Results Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900">Email Results</h2>
              <button
                type="button"
                onClick={() => { setEmailModal(null); setCopied(false); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-5">
              <ul className="space-y-2">
                {emailModal.results.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-800 truncate">{r.name}</span>
                    {r.email ? (
                      <span className="text-gray-600 truncate">{r.email}</span>
                    ) : (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === 'no-linkedin'
                          ? 'bg-gray-100 text-gray-500'
                          : r.status === 'duplicate'
                            ? 'bg-amber-100 text-amber-700'
                            : r.status === 'error'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.status === 'no-linkedin' ? 'No LinkedIn' : r.status === 'duplicate' ? 'Duplicate (email exists)' : r.status === 'error' ? 'Error' : 'Not found'}
                      </span>
                    )}
                    {r.status === 'enriched' && (
                      <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">New</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {emailModal.emails.length > 0 && (
              <div className="border-t border-gray-200 p-5 space-y-3">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 break-all select-all font-mono leading-relaxed">
                  {emailModal.emails.join(', ')}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyEmails}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied ? (
                      <><CheckCheck className="h-4 w-4" /> Copied!</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy {emailModal.emails.length} Email{emailModal.emails.length !== 1 ? 's' : ''}</>
                    )}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-400">
                  {emailModal.results.length - emailModal.emails.length} contact{emailModal.results.length - emailModal.emails.length !== 1 ? 's' : ''} had no email found
                </p>
              </div>
            )}

            {emailModal.emails.length === 0 && (
              <div className="border-t border-gray-200 p-5 text-center text-sm text-gray-500">
                No emails found. Add LinkedIn URLs to contacts to enable Apollo enrichment.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactsViewPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">
            Loading Contacts…
          </div>
        </div>
      </div>
    }>
      <ContactsViewPageContent />
    </Suspense>
  );
}
