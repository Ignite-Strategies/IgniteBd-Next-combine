'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';
import { getValidatedContactsCache } from '@/lib/utils/validateContactsCache';
import { ContactsContext } from '../contacts/ContactsContext';

export default function PeopleLayout({ children }) {
  const { companyHQId } = useCompanyHQ();
  const [contacts, setContacts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // Step 1: Check localStorage cache with validation (only when companyHQId is available)
  useEffect(() => {
    if (typeof window === 'undefined' || !companyHQId) return;

    // Use validation utility to safely get cached contacts
    const cacheResult = getValidatedContactsCache(companyHQId);
    
    if (cacheResult.isValid && cacheResult.contacts.length > 0) {
      console.log('✅ Using validated contacts cache:', cacheResult.contacts.length);
      setContacts(cacheResult.contacts);
      setHydrated(true);
    } else {
      // Invalid or empty cache - will be fetched by refreshContacts
      console.log('⚠️ Contacts cache invalid or empty:', cacheResult.reason);
      setContacts([]);
      setHydrated(false);
    }
  }, [companyHQId]);

  // Step 2: Fetch from API when companyHQId is available
  const refreshContacts = useCallback(async () => {
    if (!companyHQId) {
      console.warn('⚠️ refreshContacts called without companyHQId');
      return;
    }

    setHydrating(true);
    try {
      console.log('🔄 Fetching contacts for companyHQId:', companyHQId);
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      
      if (response.data?.success && Array.isArray(response.data.contacts)) {
        const fetchedContacts = response.data.contacts;
        console.log('✅ Fetched contacts:', fetchedContacts.length);
        setContacts(fetchedContacts);
        
        // Step 3: Store in localStorage (includes pipeline data)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(fetchedContacts));
        }
        setHydrated(true);
      } else {
        console.warn('⚠️ API response missing success or contacts array:', response.data);
        const fetchedContacts = response.data?.contacts ?? [];
        setContacts(fetchedContacts);
        setHydrated(true);
      }
    } catch (error) {
      console.error('❌ Error fetching contacts:', error);
      console.error('❌ Error response:', error.response?.data);
      // Don't clear contacts on error - keep cached data
    } finally {
      setHydrating(false);
    }
  }, [companyHQId]);

  // Auto-refresh contacts when companyHQId changes (if cache is invalid or empty)
  useEffect(() => {
    if (!companyHQId) return;
    
    // If we don't have valid cached contacts, fetch from API
    if (!hydrated || contacts.length === 0) {
      console.log('🔄 Fetching contacts - no valid cache');
      refreshContacts();
    }
  }, [companyHQId, hydrated, contacts.length, refreshContacts]);

  // Helper: Update a single contact in state and localStorage
  const updateContact = useCallback((contactId, updates) => {
    setContacts((prev) => {
      const updated = prev.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contacts', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Add a new contact to state and localStorage
  const addContact = useCallback((contact) => {
    setContacts((prev) => {
      const updated = [...prev, contact];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contacts', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Remove a contact from state and localStorage
  const removeContact = useCallback((contactId) => {
    setContacts((prev) => {
      const updated = prev.filter((contact) => contact.id !== contactId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contacts', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      contacts,
      setContacts,
      companyHQId,
      hydrated,
      hydrating,
      refreshContacts,
      updateContact,
      addContact,
      removeContact,
    }),
    [contacts, companyHQId, hydrated, hydrating, refreshContacts, updateContact, addContact, removeContact],
  );

  return (
    <ContactsContext.Provider value={contextValue}>
      {children}
    </ContactsContext.Provider>
  );
}

