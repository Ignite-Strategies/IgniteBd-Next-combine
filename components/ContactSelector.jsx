'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { useOwner } from '@/hooks/useOwner';

/**
 * ContactSelector Component - SEARCH FIRST
 * Simple search input that shows dropdown results when typing
 * No auto-select, no localStorage persistence - pure search
 */
export default function ContactSelector({ 
  contactId, 
  onContactSelect,
  onContactChange, // Legacy support
  selectedContact,
  showLabel = true,
  className = '',
  companyId, // Optional: filter contacts by company
  companyHQId: propCompanyHQId, // Optional: pass companyHQId from URL params (preferred)
}) {
  // Use prop companyHQId if provided, otherwise fall back to hook (for backward compatibility)
  const { companyHQId: hookCompanyHQId, hydrated: companyHydrated } = useCompanyHQ();
  const companyHQId = propCompanyHQId || hookCompanyHQId;
  const { ownerId, hydrated: ownerHydrated } = useOwner();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(contactId || null);

  // Debug: Log companyId and companyHQId props
  useEffect(() => {
    console.log('🔍 ContactSelector props:', {
      companyId,
      companyHQId: propCompanyHQId,
      usingHook: !propCompanyHQId,
    });
  }, [companyId, propCompanyHQId]);

  // Fetch contacts from API - WAIT FOR AUTH
  useEffect(() => {
    const fetchContacts = async () => {
      if (typeof window === 'undefined') return;
      
      // CRITICAL: Wait for auth to be ready before making API calls
      if (!ownerId || !ownerHydrated) {
        // Auth not ready yet - wait
        return;
      }
      
      // Use prop companyHQId if provided (from URL params), otherwise use hook
      const finalCompanyHQId = companyHQId;
      
      if (!finalCompanyHQId) {
        // Still no companyHQId - if not hydrated yet, wait; otherwise show error
        if (!companyHydrated && !propCompanyHQId) {
          // Still loading company data, keep loading state (only if using hook)
          return;
        }
        console.warn('ContactSelector: No companyHQId available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        console.log('🔍 ContactSelector: Fetching contacts from API', {
          companyHQId: finalCompanyHQId,
          companyId: companyId,
          hasCompanyIdFilter: !!companyId
        });
        
        // NO localStorage - always fetch from API
        let apiUrl = `/api/contacts?companyHQId=${finalCompanyHQId}`;
        if (companyId) {
          apiUrl += `&companyId=${encodeURIComponent(companyId)}`;
        }
        
        const response = await api.get(apiUrl);
        if (response.data?.success && response.data.contacts) {
          let fetched = response.data.contacts;
          console.log('✅ ContactSelector: Received', fetched.length, 'contacts from API', 
            companyId ? `(filtered by companyId: ${companyId})` : '(all contacts)');
          
          // API now filters by companyId server-side, so no client-side filtering needed
          // But log the results for debugging
          if (companyId && fetched.length === 0) {
            console.warn('⚠️⚠️⚠️ NO CONTACTS FOUND for companyId:', companyId);
            console.warn('⚠️ This means no contacts have contactCompanyId matching:', companyId);
          } else if (companyId && fetched.length > 0) {
            console.log('✅ Found', fetched.length, 'contacts for companyId:', companyId);
            console.log('📋 Contacts:', fetched.slice(0, 5).map(c => ({
              name: `${c.firstName} ${c.lastName}`,
              email: c.email,
              contactCompanyId: c.contactCompanyId
            })));
          }
          
          setContacts(fetched);
          // NO localStorage - API only
        } else {
          console.warn('API response missing contacts:', response.data);
          setContacts([]);
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [companyHQId, companyHydrated, refreshCompanyHQ, companyId, ownerId, ownerHydrated]); // Wait for auth before fetching

  // Initialize from props only
  useEffect(() => {
    if (contactId) {
      setSelectedContactId(contactId);
      // Set search value to selected contact name if available
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
      }
      return;
    }
    
    if (selectedContact?.id) {
      setSelectedContactId(selectedContact.id);
      setContactSearch(`${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email || '');
      return;
    }
    
    // NO auto-select - search-first
    setSelectedContactId(null);
    setContactSearch('');
  }, [contactId, selectedContact, contacts]);

  // Get selected contact object (computed from selectedContactId)
  const selectedContactObj = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((c) => c.id === selectedContactId);
  }, [contacts, selectedContactId]);

    // Filter contacts based on search query - exclude already selected contact
  const availableContacts = useMemo(() => {
    if (!contactSearch || !contactSearch.trim()) {
      return [];
    }
    
    // If a contact is selected and search matches exactly, don't show dropdown
    if (selectedContactObj) {
      const selectedName = `${selectedContactObj.firstName || ''} ${selectedContactObj.lastName || ''}`.trim().toLowerCase();
      const selectedEmail = (selectedContactObj.email || '').toLowerCase();
      const searchLower = contactSearch.toLowerCase();
      
      // If search exactly matches selected contact, return empty (hide dropdown)
      if (searchLower === selectedName || searchLower === selectedEmail) {
        return [];
      }
    }
    
    const searchLower = contactSearch.toLowerCase();
    const filtered = contacts
      .filter((contact) => {
        // Exclude already selected contact from results
        if (selectedContactId && contact.id === selectedContactId) {
          return false;
        }
        
        const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const company = (contact.contactCompany?.companyName || contact.companies?.companyName || '').toLowerCase();
        
        const matches = name.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
        
        if (matches && contactSearch.length >= 2) {
          console.log('🔍 Contact matches search:', {
            name: `${contact.firstName} ${contact.lastName}`,
            email: contact.email,
            company: contact.contactCompany?.companyName || contact.companies?.companyName,
            contactCompanyId: contact.contactCompanyId,
            contactCompanyId: contact.contactCompany?.id,
            companiesId: contact.companies?.id
          });
        }
        
        return matches;
      })
      .slice(0, 20);
    
    if (contactSearch.length >= 2 && filtered.length === 0 && contacts.length > 0) {
      console.log('⚠️ No contacts match search, but contacts exist:', {
        searchTerm: contactSearch,
        totalContacts: contacts.length,
        sampleContact: contacts[0] ? {
          name: `${contacts[0].firstName} ${contacts[0].lastName}`,
          company: contacts[0].contactCompany?.companyName || contacts[0].companies?.companyName
        } : null
      });
    }
    
    return filtered;
  }, [contacts, contactSearch, selectedContactId, selectedContactObj]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContactId(contact.id);
    const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '';
    setContactSearch(displayName);
    
    // Call callback - support both onContactSelect and onContactChange
    if (onContactSelect) {
      const company = contact.contactCompany || null;
      onContactSelect(contact, company);
    }
    if (onContactChange) {
      onContactChange(contact);
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
        {/* Search Input - Simple search bar like Manage Contacts page */}
        <div className="relative">
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder={loading ? "Loading contacts..." : companyId ? "Search contacts from this company..." : "Search contacts by name, email, or company..."}
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-red-500 focus:ring-2 focus:ring-red-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
            ) : (
              <Users className="h-5 w-5 text-gray-400" />
            )}
          </div>
          {selectedContactObj && !loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
            </div>
          )}
        </div>
        
        {/* Show message if no companyHQId */}
        {!companyHQId && companyHydrated && !loading && (
          <p className="mt-2 text-xs text-amber-600">
            Unable to load contacts. Please refresh the page or check your company settings.
          </p>
        )}

        {/* Dropdown Results - Only shows when searching (like Manage Contacts) */}
        {contactSearch && availableContacts.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
            {availableContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelectContact(contact)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
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
            ))}
          </div>
        )}

        {/* Show selected contact info below input */}
        {selectedContactObj && (
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
            <p className="text-xs text-green-800">
              <strong>Selected:</strong> {selectedContactObj.firstName} {selectedContactObj.lastName}
              {selectedContactObj.contactCompany?.companyName && (
                <span> • {selectedContactObj.contactCompany.companyName}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
