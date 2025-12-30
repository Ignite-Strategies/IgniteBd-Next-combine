'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Mail, RefreshCw, Sparkles, Check } from 'lucide-react';

function MicrosoftEnrichContent() {
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Direct read from localStorage for ownerId and owner - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOwnerId = localStorage.getItem('ownerId');
    const storedOwner = localStorage.getItem('owner');
    if (storedOwnerId) setOwnerId(storedOwnerId);
    if (storedOwner) {
      try {
        setOwner(JSON.parse(storedOwner));
      } catch (e) {
        console.warn('Failed to parse owner', e);
      }
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [enriching, setEnriching] = useState(false);

  async function handleFetchContacts() {
    // Check Microsoft connection from owner hook (no API call needed)
    if (!owner?.microsoftAccessToken) {
      if (!ownerId) {
        alert('Please wait for authentication to complete');
        return;
      }
      // Redirect to login with ownerId
      window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
      return;
    }

    setLoading(true);
    try {

      const contactsResponse = await api.get('/api/microsoft-graph/contacts');
      if (contactsResponse.data?.success) {
        const parsed = (contactsResponse.data.contacts || []).map((contact) => {
          const email =
            contact.emailAddresses?.[0]?.address ||
            contact.mail ||
            contact.userPrincipalName;
          if (!email) return null;

          return {
            email,
            firstName: contact.givenName || contact.firstName,
            lastName: contact.surname || contact.lastName,
            company: contact.companyName,
            title: contact.jobTitle,
            id: null, // Will be found by email during enrichment
          };
        }).filter(Boolean);

        setContacts(parsed);
      }
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(email) {
    setSelected((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  }

  async function handleEnrich() {
    if (selected.size === 0) {
      alert('Please select at least one contact');
      return;
    }

    setEnriching(true);
    // TODO: Implement Microsoft enrichment (will need to find contacts by email first)
    alert('Microsoft enrichment coming soon');
    setEnriching(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-6">📧 Microsoft Email Enrichment</h1>

        {/* Fetch Button */}
        <div className="bg-white p-6 rounded-lg shadow border mb-6">
          <button
            onClick={handleFetchContacts}
            disabled={loading}
            className="bg-purple-600 text-white px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4" />
                Loading...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Fetch Microsoft Contacts
              </>
            )}
          </button>
        </div>

        {/* Contact List */}
        {contacts.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg">
                Select Contacts ({selected.size} of {contacts.length})
              </h2>
              <button
                onClick={() => {
                  if (selected.size === contacts.length) {
                    setSelected(new Set());
                  } else {
                    setSelected(new Set(contacts.map((c) => c.email)));
                  }
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                {selected.size === contacts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(contact.email)}
                    onChange={() => toggleSelect(contact.email)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span className="text-xs text-gray-600 block">{contact.email}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleEnrich}
              disabled={enriching || selected.size === 0}
              className="mt-4 bg-purple-600 text-white px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Enriching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enrich Selected ({selected.size})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MicrosoftEnrich() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <MicrosoftEnrichContent />
    </Suspense>
  );
}

