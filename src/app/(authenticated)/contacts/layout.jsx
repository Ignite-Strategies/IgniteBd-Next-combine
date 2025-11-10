'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';

const ContactsContext = createContext({
  contacts: [],
  setContacts: () => {},
  companyHQId: '',
  hydrated: false,
  hydrating: false,
  refreshContacts: async () => {},
});

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within ContactsLayout');
  }
  return context;
}

export default function ContactsLayout({ children }) {
  const { companyHQId } = useCompanyHQ(); // Get companyHQId from hook
  const [contacts, setContacts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // Step 1: Check localStorage cache
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
    if (!companyHQId) return;

    setHydrating(true);
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      const fetchedContacts = response.data?.contacts ?? [];
      
      setContacts(fetchedContacts);
      
      // Step 3: Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contacts', JSON.stringify(fetchedContacts));
      }
      setHydrated(true);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setHydrating(false);
    }
  }, [companyHQId]);

  // Step 4: Auto-fetch if not hydrated
  useEffect(() => {
    if (companyHQId && !hydrated) {
      refreshContacts();
    }
  }, [companyHQId, hydrated, refreshContacts]);

  const contextValue = useMemo(
    () => ({
      contacts,
      setContacts,
      companyHQId,
      hydrated,
      hydrating,
      refreshContacts,
    }),
    [contacts, companyHQId, hydrated, hydrating, refreshContacts],
  );

  return (
    <ContactsContext.Provider value={contextValue}>
      {children}
    </ContactsContext.Provider>
  );
}
