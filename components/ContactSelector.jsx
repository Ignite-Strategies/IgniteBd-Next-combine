'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Users } from 'lucide-react';
import api from '@/lib/api';

/**
 * ContactSelector Component - SEARCH FIRST
 * Simple search input that shows dropdown results when typing
 * No auto-select, no localStorage persistence - pure search
 * 
 * REQUIRES companyHQId prop (from URL params) - NO HOOKS
 */
export default function ContactSelector({ 
  contactId, 
  onContactSelect,
  onContactChange, // Legacy support
  selectedContact,
  showLabel = true,
  className = '',
  companyId, // Optional: filter contacts by company
  companyHQId: propCompanyHQId = undefined, // REQUIRED: pass companyHQId from URL params
}) {
  // Direct read from localStorage for ownerId - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  const [ownerHydrated, setOwnerHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) {
      setOwnerId(stored);
      setOwnerHydrated(true);
    }
  }, []);
  
  // Use prop companyHQId (from URL params) - REQUIRED
  const companyHQId = propCompanyHQId;
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(contactId || null);

  // Handle contact selection (defined before use in useEffect)
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

  // Load specific contact from URL param (if contactId provided)
  useEffect(() => {
    if (!contactId || !companyHQId || !ownerId || !ownerHydrated) return;
    
    // Fetch this specific contact
    const fetchContact = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/contacts/${contactId}`);
        if (response.data?.success && response.data.contact) {
          const contact = response.data.contact;
          setContacts([contact]); // Set as single contact in array
          handleSelectContact(contact);
        }
      } catch (err) {
        console.error('Failed to load contact from URL:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, companyHQId, ownerId, ownerHydrated]);

  // STEP 3: Load contacts - ONLY when user types (debounced, scoped from companyHQId params)
  useEffect(() => {
    if (!companyHQId || !ownerId || !ownerHydrated) return;
    
    // Don't fetch if search is too short or empty
    if (!contactSearch || contactSearch.trim().length < 2) {
      setContacts([]);
      return;
    }
    
    // Debounce search - wait 300ms after user stops typing
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        console.log('🔍 STEP 3: Contacts - Loading (user typed)', {
          companyHQId,
          search: contactSearch,
          companyId: companyId,
        });
        
        // Fetch all contacts for companyHQ (scoped from params)
        // Client-side filtering happens in availableContacts useMemo
        let apiUrl = `/api/contacts?companyHQId=${companyHQId}`;
        if (companyId) {
          apiUrl += `&companyId=${encodeURIComponent(companyId)}`;
        }
        
        const response = await api.get(apiUrl);
        if (response.data?.success && response.data.contacts) {
          const fetched = response.data.contacts;
          console.log('✅ STEP 3: Contacts - Loaded', fetched.length, 'contacts (will filter client-side)');
          setContacts(fetched);
        } else {
          setContacts([]);
        }
      } catch (err) {
        console.error('❌ STEP 3: Contacts - Error loading:', err);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [contactSearch, companyHQId, companyId, ownerId, ownerHydrated]);

  // Track if user is actively typing to prevent clearing
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  
  // Initialize from props only - but don't clear if user is typing
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
    
    // Only sync if selectedContact is provided AND different from current
    // AND user is not actively typing
    if (selectedContact?.id && !isTypingRef.current) {
      // Only update if it's actually different
      if (selectedContactId !== selectedContact.id) {
        setSelectedContactId(selectedContact.id);
        setContactSearch(`${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email || '');
      }
      return;
    }
    
    // Don't clear search if user is actively typing
    // Never auto-clear - let the user clear manually or via handleClearContact
  }, [contactId, selectedContact?.id, selectedContactId]); // Include selectedContactId to track changes

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
            onChange={(e) => {
              // Mark that user is typing
              isTypingRef.current = true;
              setContactSearch(e.target.value);
              
              // Clear typing flag after 1 second of no typing
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
              }, 1000);
            }}
            onFocus={() => {
              isTypingRef.current = true;
            }}
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
        {!companyHQId && !loading && (
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
