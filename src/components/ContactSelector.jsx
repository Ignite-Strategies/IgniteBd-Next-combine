'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

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
}) {
  const { companyHQId, hydrated: companyHydrated, refresh: refreshCompanyHQ } = useCompanyHQ();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(contactId || null);

  // Debug: Log companyId prop
  useEffect(() => {
    console.log('🔍 ContactSelector companyId prop:', companyId);
  }, [companyId]);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      if (typeof window === 'undefined') return;
      
      // If companyHQId is not available yet, try to refresh it
      if (!companyHQId && companyHydrated) {
        // Company is hydrated but no ID - try refreshing
        await refreshCompanyHQ();
        // After refresh, check localStorage again (refreshCompanyHQ updates localStorage)
        const refreshedId = 
          window.localStorage.getItem('companyHQId') ||
          window.localStorage.getItem('companyId') ||
          '';
        if (!refreshedId) {
          console.warn('ContactSelector: No companyHQId available after refresh');
          setLoading(false);
          return;
        }
        // Continue with refreshedId - the effect will run again when companyHQId updates
        // But we can proceed with the localStorage value
      }
      
      // Get companyHQId from hook or localStorage
      let finalCompanyHQId = companyHQId;
      if (!finalCompanyHQId) {
        finalCompanyHQId = 
          window.localStorage.getItem('companyHQId') ||
          window.localStorage.getItem('companyId') ||
          '';
      }
      
      if (!finalCompanyHQId) {
        // Still no companyHQId - if not hydrated yet, wait; otherwise show error
        if (!companyHydrated) {
          // Still loading company data, keep loading state
          return;
        }
        console.warn('ContactSelector: No companyHQId available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        console.log('🔍 ContactSelector: Fetching contacts', {
          companyHQId: finalCompanyHQId,
          companyId: companyId,
          hasCompanyIdFilter: !!companyId
        });
        
        // Try localStorage first for quick display
        const cached = window.localStorage.getItem('contacts');
        let cachedContacts = [];
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedContacts = parsed;
              // Don't set contacts yet if we have companyId filter - wait for API
              if (!companyId) {
                setContacts(parsed);
                setLoading(false);
              }
            }
          } catch (err) {
            console.warn('Failed to parse cached contacts', err);
          }
        }
        
        // Fetch from API to get latest data
        // If companyId is provided, filter contacts by that company
        let apiUrl = `/api/contacts?companyHQId=${finalCompanyHQId}`;
        console.log('🔍 ContactSelector: Fetching from API:', apiUrl, 'with companyId filter:', companyId);
        const response = await api.get(apiUrl);
        if (response.data?.success && response.data.contacts) {
          let fetched = response.data.contacts;
          console.log('✅ ContactSelector: Received', fetched.length, 'contacts from API');
          
          // Filter by companyId if provided
          if (companyId) {
            console.log('🔍 FILTERING contacts by companyId:', companyId);
            console.log('🔍 Total contacts before filter:', fetched.length);
            
            // Log first 5 contacts to see their structure
            console.log('📋 First 5 contacts structure:', fetched.slice(0, 5).map(c => ({
              name: `${c.firstName} ${c.lastName}`,
              contactCompanyId: c.contactCompanyId,
              contactCompanyId: c.contactCompany?.id,
              companiesId: c.companies?.id,
              hasContactCompany: !!c.contactCompany,
              hasCompanies: !!c.companies,
              companyName: c.contactCompany?.companyName || c.companies?.companyName
            })));
            
            const filtered = fetched.filter(contact => {
              const matches = contact.contactCompanyId === companyId || 
                     contact.contactCompany?.id === companyId ||
                     contact.companies?.id === companyId;
              
              if (matches) {
                console.log('✅ MATCH:', `${contact.firstName} ${contact.lastName}`, {
                  contactCompanyId: contact.contactCompanyId,
                  contactCompanyId: contact.contactCompany?.id,
                  companiesId: contact.companies?.id
                });
              }
              
              return matches;
            });
            
            console.log('🔍 Total contacts after filter:', filtered.length);
            
            // If filtering returns 0 results, show warning but still use empty array
            // (don't fall back to all contacts - user needs to select correct company)
            if (filtered.length === 0 && fetched.length > 0) {
              console.warn('⚠️⚠️⚠️ NO CONTACTS FOUND for companyId:', companyId);
              console.warn('⚠️ All contacts have these companyIds:', 
                fetched.slice(0, 10).map(c => ({
                  name: `${c.firstName} ${c.lastName}`,
                  contactCompanyId: c.contactCompanyId,
                  contactCompanyId: c.contactCompany?.id,
                  companiesId: c.companies?.id,
                  email: c.email
                }))
              );
            }
            
            fetched = filtered;
          } else {
            console.log('ℹ️ No companyId filter - showing all', fetched.length, 'contacts');
          }
          
          setContacts(fetched);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('contacts', JSON.stringify(fetched));
          }
        } else {
          console.warn('API response missing contacts:', response.data);
          // If API fails but we have cached contacts, keep using them
          if (cachedContacts.length > 0) {
            let filtered = cachedContacts;
            // Filter cached contacts by companyId if provided
            if (companyId) {
              filtered = cachedContacts.filter(contact => {
                return contact.contactCompanyId === companyId || 
                       contact.contactCompany?.id === companyId ||
                       contact.companies?.id === companyId;
              });
            }
            setContacts(filtered);
          }
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        // If API fails but we have cached contacts, keep using them
        const cached = window.localStorage.getItem('contacts');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setContacts(parsed);
            }
          } catch (parseErr) {
            console.warn('Failed to use cached contacts after API error', parseErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [companyHQId, companyHydrated, refreshCompanyHQ, companyId]); // companyId in deps so it re-fetches when company changes

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
