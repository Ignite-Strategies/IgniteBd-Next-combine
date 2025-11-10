'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '@/lib/api';

const ContactsContext = createContext({
  contacts: [],
  setContacts: () => {},
  companyHQId: '',
  hydrated: false,
  hydrating: false,
  refreshContacts: async () => {},
});

export function useContactsContext() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContactsContext must be used within ContactsLayout');
  }
  return context;
}

export default function ContactsLayout({ children }) {
  const [contacts, setContacts] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';

    if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
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
    }
  }, []);

  const refreshContacts = useCallback(
    async (tenantId = companyHQId) => {
      if (!tenantId) {
        return;
      }

      try {
        setHydrating(true);
        const response = await api.get(`/api/contacts?companyHQId=${tenantId}`);
        const fetchedContacts = response.data?.contacts ?? [];
        setContacts(fetchedContacts);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(fetchedContacts));
        }
        setHydrated(true);
      } catch (error) {
        console.error('Error hydrating contacts:', error);
      } finally {
        setHydrating(false);
      }
    },
    [companyHQId],
  );

  useEffect(() => {
    if (companyHQId && !hydrated) {
      refreshContacts(companyHQId);
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
