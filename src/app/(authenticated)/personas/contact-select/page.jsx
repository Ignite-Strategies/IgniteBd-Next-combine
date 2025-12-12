'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Building2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

export default function ContactSelectPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(null);
  
  // Use hook to get companyHQId (fetches from API if not in localStorage)
  const { companyHQId, loading: companyLoading, refresh } = useCompanyHQ();

  // Fetch companyHQId from API if not in localStorage
  useEffect(() => {
    if (!companyHQId && !companyLoading) {
      refresh();
    }
  }, [companyHQId, companyLoading, refresh]);

  // Fetch contacts
  useEffect(() => {
    if (!companyHQId || companyLoading) return;

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
  }, [companyHQId, companyLoading]);

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const companyName = (contact.company?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
      
      return (
        fullName.includes(query) ||
        email.includes(query) ||
        companyName.includes(query)
      );
    });
  }, [contacts, searchQuery]);

  const handleCreatePersona = () => {
    if (!selectedContactId) return;
    router.push(`/personas/from-contact?contactId=${selectedContactId}`);
  };

  // Show loading while fetching companyHQId
  if (companyLoading || (!companyHQId && !error)) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if companyHQId still not available after loading
  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load company context. Please ensure you are logged in and try refreshing the page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Personas
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Select a Contact</h1>
          <p className="mt-2 text-gray-600">
            Search and select a contact to create a persona from
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
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
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {filteredContacts.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-lg font-semibold text-gray-900">No contacts found</p>
                <p className="mt-2 text-sm text-gray-600">
                  {searchQuery
                    ? 'Try a different search query'
                    : 'No contacts available. Create contacts first.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => {
                  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
                  const companyName = contact.company?.companyName || contact.contactCompany?.companyName || 'No Company';
                  const isSelected = selectedContactId === contact.id;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContactId(contact.id)}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition ${
                        isSelected
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                          {contact.title && (
                            <p className="text-sm text-gray-600">{contact.title}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            {contact.email && (
                              <span>{contact.email}</span>
                            )}
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span>{companyName}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="ml-4 rounded-full bg-red-500 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Persona Button */}
            {selectedContactId && (
              <div className="mt-6">
                <button
                  onClick={handleCreatePersona}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-red-700"
                >
                  Create Persona From This Contact
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

