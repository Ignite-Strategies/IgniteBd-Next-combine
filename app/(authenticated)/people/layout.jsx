'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';
import { ContactsContext } from '../contacts/ContactsContext';

export default function PeopleLayout({ children }) {
  const { companyHQId } = useCompanyHQ();
  const [contacts, setContacts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // Step 1: Fetch from API when companyHQId is available
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
        console.log('✅ Fetched contacts from API:', fetchedContacts.length, 'for companyHQId:', companyHQId);
        setContacts(fetchedContacts);
        // NO localStorage - API only
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

  // NO localStorage - always fetch from API when companyHQId is available
  useEffect(() => {
    if (!companyHQId) {
      setContacts([]);
      setHydrated(false);
      return;
    }
    
    // Always fetch from API - no localStorage cache
    // Inline fetch logic to avoid circular dependency with refreshContacts
    let isMounted = true;
    const fetchContacts = async () => {
      setHydrating(true);
      try {
        console.log('🔄 Fetching contacts for companyHQId:', companyHQId);
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        
        if (!isMounted) return;
        
        if (response.data?.success && Array.isArray(response.data.contacts)) {
          const fetchedContacts = response.data.contacts;
          console.log('✅ Fetched contacts from API:', fetchedContacts.length, 'for companyHQId:', companyHQId);
          setContacts(fetchedContacts);
          // NO localStorage - API only
          setHydrated(true);
        } else {
          console.warn('⚠️ API response missing success or contacts array:', response.data);
          const fetchedContacts = response.data?.contacts ?? [];
          setContacts(fetchedContacts);
          setHydrated(true);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('❌ Error fetching contacts:', error);
        console.error('❌ Error response:', error.response?.data);
        // Don't clear contacts on error - keep cached data
      } finally {
        if (isMounted) {
          setHydrating(false);
        }
      }
    };
    
    fetchContacts();
    
    return () => {
      isMounted = false;
    };
  }, [companyHQId]);

  // Contacts are always fetched from API when companyHQId changes (handled above)

  // Helper: Update a single contact in state (NO localStorage)
  const updateContact = useCallback((contactId, updates) => {
    setContacts((prev) => {
      return prev.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      );
    });
  }, []);

  // Helper: Add a new contact to state (NO localStorage)
  const addContact = useCallback((contact) => {
    setContacts((prev) => [...prev, contact]);
  }, []);

  // Helper: Remove a contact from state (NO localStorage)
  const removeContact = useCallback((contactId) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
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

