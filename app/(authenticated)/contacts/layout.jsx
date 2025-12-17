'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';
import { ContactsContext } from './ContactsContext';

export default function ContactsLayout({ children }) {
  const { companyHQId } = useCompanyHQ(); // Get companyHQId from hook
  const [contacts, setContacts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // Step 1: Check localStorage cache on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cached = window.localStorage.getItem('contacts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setContacts(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached contacts', error);
      }
    }
  }, []);

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

  // No auto-fetch - only use localStorage. Use refreshContacts() manually via sync button

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
