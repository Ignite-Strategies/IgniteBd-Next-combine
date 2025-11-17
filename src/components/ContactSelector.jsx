'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, ChevronDown, X } from 'lucide-react';
import api from '@/lib/api';

/**
 * ContactSelector Component
 * 
 * Reusable contact selector for client delivery section.
 * - Shows dropdown/autocomplete of contacts
 * - Persists selection in localStorage and URL params
 * - Displays current selection with change option
 * - Fetches contacts directly from API (no layout dependency)
 */
export default function ContactSelector({ 
  contactId, 
  onContactSelect,
  onContactChange, // Legacy support
  selectedContact,
  showLabel = true,
  className = '',
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      if (typeof window === 'undefined') return;
      
      const companyHQId = 
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyId') ||
        '';
      
      if (!companyHQId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Try localStorage first
        const cached = window.localStorage.getItem('contacts');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setContacts(parsed);
              setLoading(false);
            }
          } catch (err) {
            console.warn('Failed to parse cached contacts', err);
          }
        }
        
        // Fetch from API
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        if (response.data?.success && response.data.contacts) {
          const fetched = response.data.contacts;
          setContacts(fetched);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('contacts', JSON.stringify(fetched));
          }
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  // Initialize from prop or URL param only (NO localStorage auto-select)
  useEffect(() => {
    if (contactId) {
      setSelectedContactId(contactId);
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    // Only use URL param if explicitly provided
    const urlContactId = searchParams.get('contactId');
    if (urlContactId) {
      setSelectedContactId(urlContactId);
      return;
    }
    
    // NO auto-select from localStorage - search-first approach
    // User must search and select manually
  }, [contactId, searchParams]);

  // Filter contacts based on search query - SEARCH-FIRST (require query to show results)
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return []; // Empty if no search query - search-first!
    
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (contact.contactCompany?.companyName || '').toLowerCase();
      
      return name.includes(query) || email.includes(query) || company.includes(query);
    });
  }, [contacts, searchQuery]);

  // Get selected contact object
  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((c) => c.id === selectedContactId);
  }, [contacts, selectedContactId]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContactId(contact.id);
    setIsOpen(false);
    setSearchQuery('');
    
    // Call callback - support both onContactSelect and onContactChange
    if (onContactSelect) {
      // Get company from contact if available
      const company = contact.contactCompany || null;
      onContactSelect(contact, company);
    }
    if (onContactChange) {
      onContactChange(contact);
    }
  };

  // Handle clear selection
  const handleClear = () => {
    setSelectedContactId(null);
    setIsOpen(false);
    setSearchQuery('');
    
    // Call callback
    if (onContactSelect) {
      onContactSelect(null, null);
    }
    if (onContactChange) {
      onContactChange(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {showLabel && (
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Select Contact
        </label>
      )}
      
      <div className="relative">
        {/* Selected Contact Display */}
        {selectedContact ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedContact.firstName} {selectedContact.lastName}
                </div>
                {selectedContact.contactCompany?.companyName && (
                  <div className="text-xs text-gray-500">
                    {selectedContact.contactCompany.companyName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                title="Change contact"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left shadow-sm hover:border-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <span className="text-sm text-gray-500">Select a contact...</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Dropdown - SEARCH FIRST */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {/* Search Input */}
            <div className="border-b border-gray-200 p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search contacts..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                autoFocus
              />
            </div>

            {/* Contact List - Only shows results when searching */}
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading contacts...
                </div>
              ) : !searchQuery.trim() ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Type to search for contacts...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                      selectedContactId === contact.id ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {contact.firstName} {contact.lastName}
                    </div>
                    {contact.email && (
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    )}
                    {contact.contactCompany?.companyName && (
                      <div className="text-xs text-gray-400">
                        {contact.contactCompany.companyName}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

