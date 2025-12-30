'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users, Building2, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function ContactSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch contacts
  useEffect(() => {
    if (!companyHQId) {
      setError('Company context is required');
      setLoading(false);
      return;
    }

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

  // Filter contacts
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const companyName = (contact.company?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
    return fullName.includes(query) || email.includes(query) || companyName.includes(query);
  });

  const handleContactSelect = async (contactId) => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Route contract: Only contactId and companyHQId are required
      // Owner is derived from Firebase token (auth header)
      const response = await api.post('/api/personas/generate-minimal', {
        companyHQId,
        contactId,
      });

      if (response.data?.success && response.data?.persona) {
        // Store generated persona in localStorage
        localStorage.setItem('tempPersonaData', JSON.stringify(response.data.persona));
        // Navigate after API completes
        router.push(`/personas/from-contact?contactId=${contactId}&companyHQId=${companyHQId}`);
      } else {
        setError(response.data?.error || 'Failed to generate persona');
        setGenerating(false);
      }
    } catch (err) {
      console.error('Failed to generate persona:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate persona');
      setGenerating(false);
    }
  };

  if (!companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Company context is required
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
            Choose a contact to generate a persona from
          </p>
        </div>

        {/* Search */}
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

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Generating Overlay */}
        {generating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-xl">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
              <p className="mt-4 text-lg font-semibold text-gray-900">Generating persona...</p>
              <p className="mt-2 text-sm text-gray-600">This may take a moment</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
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
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-lg font-semibold text-gray-900">No contacts found</p>
                <p className="mt-2 text-sm text-gray-600">
                  {searchQuery ? 'Try a different search query' : 'No contacts available'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => {
                  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
                  const companyName = contact.company?.companyName || contact.contactCompany?.companyName || 'No Company';

                  return (
                    <div
                      key={contact.id}
                      onClick={() => !generating && handleContactSelect(contact.id)}
                      className={`cursor-pointer rounded-lg border-2 border-gray-200 bg-white p-4 transition ${
                        generating
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                          {contact.title && (
                            <p className="text-sm text-gray-600">{contact.title}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            {contact.email && <span>{contact.email}</span>}
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span>{companyName}</span>
                            </div>
                          </div>
                        </div>
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

export default function ContactSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ContactSelectContent />
    </Suspense>
  );
}
