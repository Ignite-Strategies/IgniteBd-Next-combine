'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Search,
  RefreshCw,
  Building2,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import CompanySelector from '@/components/CompanySelector';

export default function ContactsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, errors: [] });
  const [buildingTargetList, setBuildingTargetList] = useState(false);
  const [targetListUrl, setTargetListUrl] = useState(null);

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/contacts/list?companyHQId=${stored}`);
      } else {
        router.push('/people');
      }
    }
  }, [companyHQId, router]);

  const refreshContacts = useCallback(async () => {
    if (!companyHQId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      
      if (response.data?.success && response.data.contacts) {
        setContacts(response.data.contacts);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [companyHQId]);

  useEffect(() => {
    if (companyHQId) {
      refreshContacts();
    }
  }, [companyHQId, refreshContacts]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    
    const term = searchTerm.toLowerCase();
    return contacts.filter((contact) => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const title = (contact.title || '').toLowerCase();
      const company = (contact.companies?.companyName || contact.company?.companyName || '').toLowerCase();
      
      return name.includes(term) || email.includes(term) || title.includes(term) || company.includes(term);
    });
  }, [contacts, searchTerm]);

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

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select contacts to enrich');
      return;
    }

    // Filter to only contacts with LinkedIn URLs
    const contactsToEnrich = filteredContacts.filter(
      (c) => selectedContacts.has(c.id) && c.linkedinUrl
    );

    if (contactsToEnrich.length === 0) {
      alert('Selected contacts must have LinkedIn URLs to enrich');
      return;
    }

    if (!window.confirm(`Enrich ${contactsToEnrich.length} contact${contactsToEnrich.length !== 1 ? 's' : ''} via Apollo?`)) {
      return;
    }

    setBulkEnriching(true);
    setEnrichProgress({ current: 0, total: contactsToEnrich.length, errors: [] });

    const errors = [];

    for (let i = 0; i < contactsToEnrich.length; i++) {
      const contact = contactsToEnrich[i];
      setEnrichProgress({ 
        current: i + 1, 
        total: contactsToEnrich.length, 
        errors: [...errors] 
      });

      try {
        const response = await api.post('/api/contacts/bulk-enrich', {
          contactId: contact.id,
          linkedinUrl: contact.linkedinUrl,
          companyHQId,
        });

        if (!response.data?.success) {
          errors.push({
            contact: `${contact.firstName} ${contact.lastName}`.trim() || contact.email || 'Unknown',
            error: response.data?.error || 'Unknown error',
          });
        }
      } catch (error) {
        errors.push({
          contact: `${contact.firstName} ${contact.lastName}`.trim() || contact.email || 'Unknown',
          error: error.response?.data?.error || error.message || 'Failed to enrich',
        });
      }

      // Small delay to avoid rate limiting
      if (i < contactsToEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setEnrichProgress({ 
      current: contactsToEnrich.length, 
      total: contactsToEnrich.length, 
      errors 
    });
    setBulkEnriching(false);

    // Refresh contacts after enrichment
    await refreshContacts();

    if (errors.length > 0) {
      alert(`Enriched ${contactsToEnrich.length - errors.length} contact(s). ${errors.length} error(s) occurred.`);
    } else {
      alert(`Successfully enriched ${contactsToEnrich.length} contact(s)!`);
    }

    setSelectedContacts(new Set());
  };

  const handleBuildPublicTargetList = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select contacts to include in the target list');
      return;
    }

    const contactIds = Array.from(selectedContacts);
    
    try {
      setBuildingTargetList(true);
      setTargetListUrl(null);
      
      const response = await api.post('/api/public/target-lists/create', {
        contactIds,
        companyHQId,
      });

      if (response.data?.success) {
        const fullUrl = `${window.location.origin}${response.data.publicUrl}`;
        setTargetListUrl(fullUrl);
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(fullUrl);
          alert(`Public target list created! URL copied to clipboard.\n\n${fullUrl}`);
        } catch (err) {
          alert(`Public target list created!\n\nURL: ${fullUrl}\n\n(Please copy this URL)`);
        }
      } else {
        alert(response.data?.error || 'Failed to create public target list');
      }
    } catch (error) {
      console.error('Error building public target list:', error);
      alert(error.response?.data?.error || 'Failed to create public target list');
    } finally {
      setBuildingTargetList(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <div className="mt-4 text-gray-600">Loading contacts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts List</h1>
            <p className="mt-1 text-sm text-gray-600">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedContacts.size > 0 && (
              <>
                <button
                  onClick={handleBuildPublicTargetList}
                  disabled={buildingTargetList}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {buildingTargetList ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Build Public Target List ({selectedContacts.size})
                    </>
                  )}
                </button>
                <button
                  onClick={handleBulkEnrich}
                  disabled={bulkEnriching}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkEnriching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enriching... ({enrichProgress.current}/{enrichProgress.total})
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Bulk Enrich ({selectedContacts.size})
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={refreshContacts}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contacts by name, email, title, or company..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Target List URL */}
        {targetListUrl && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-green-900">
                Public Target List Created!
              </span>
              <button
                onClick={() => setTargetListUrl(null)}
                className="text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={targetListUrl}
                readOnly
                className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(targetListUrl);
                    alert('URL copied to clipboard!');
                  } catch (err) {
                    // Fallback
                    const input = document.createElement('input');
                    input.value = targetListUrl;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    alert('URL copied to clipboard!');
                  }
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Copy URL
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {bulkEnriching && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-blue-900">
                Enriching contacts...
              </span>
              <span className="text-blue-700">
                {enrichProgress.current} / {enrichProgress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="w-12 px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Company
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  LinkedIn
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                    {searchTerm ? 'No contacts found matching your search.' : 'No contacts found.'}
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`hover:bg-gray-50 ${
                      selectedContacts.has(contact.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => handleSelectContact(contact.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        {contact.email ? (
                          <>
                            <Mail className="mr-2 h-4 w-4 text-gray-400" />
                            {contact.email}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {contact.title || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {contact.companies?.companyName || contact.company?.companyName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.linkedinUrl ? (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Profile
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          const url = companyHQId 
                            ? `/contacts/${contact.id}?companyHQId=${companyHQId}`
                            : `/contacts/${contact.id}`;
                          router.push(url);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
