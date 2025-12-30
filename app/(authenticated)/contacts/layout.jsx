'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';
import { ContactsContext } from './ContactsContext';
import { ContactListsContext } from './ContactListsContext';

export default function ContactsLayout({ children }) {
  const pathname = usePathname();
  const { companyHQId } = useCompanyHQ(); // Get companyHQId from hook
  const [contacts, setContacts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  
  // Skip fetching contacts for enrich routes - they don't need the contacts list
  // Use safe pathname check with fallback to window.location
  const isEnrichRoute = useMemo(() => {
    if (typeof window !== 'undefined' && !pathname) {
      // Fallback to window.location if pathname not available yet
      return window.location.pathname?.includes('/contacts/enrich') || false;
    }
    return pathname?.includes('/contacts/enrich') || false;
  }, [pathname]);
  
  // Contact Lists state (local-first)
  const [lists, setLists] = useState([]);
  const [listsHydrated, setListsHydrated] = useState(false);
  const [listsHydrating, setListsHydrating] = useState(false);

  // Step 2: Fetch from API when companyHQId is available
  // Define refreshContacts as a stable callback for use in context and other components
  const refreshContacts = useCallback(async () => {
    // Skip fetching for enrich routes
    if (isEnrichRoute) {
      setHydrated(true);
      setHydrating(false);
      return;
    }
    
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
      // Set hydrated to true even on error so components can render
      setHydrated(true);
    } finally {
      setHydrating(false);
    }
  }, [companyHQId, isEnrichRoute]);

  // NO localStorage - always fetch from API when companyHQId is available
  // Skip fetching for enrich routes - they don't need the contacts list
  useEffect(() => {
    // Skip fetching for enrich routes
    if (isEnrichRoute) {
      setHydrated(true);
      setHydrating(false);
      return;
    }
    
    if (!companyHQId) {
      setContacts([]);
      setHydrated(false);
      return;
    }
    
    // Always fetch from API - no localStorage cache
    // Call refreshContacts directly - it's stable within its useCallback
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
        // Set hydrated to true even on error so components can render
        setHydrated(true);
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
  }, [companyHQId, isEnrichRoute]);

  // Step 1: Check localStorage cache on mount for contact lists
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cached = window.localStorage.getItem('contactLists');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setLists(parsed);
          setListsHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached contact lists', error);
      }
    }
  }, []);

  // Contacts are always fetched from API when companyHQId changes (handled above)

  // Listen for hydration events from CompanyHQ switch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHydration = (event) => {
      const { contacts: hydratedContacts, lists: hydratedLists } = event.detail || {};
      
      if (hydratedContacts && Array.isArray(hydratedContacts)) {
        console.log('🔄 Received hydrated contacts from switch:', hydratedContacts.length);
        setContacts(hydratedContacts);
        setHydrated(true);
      }
      
      if (hydratedLists && Array.isArray(hydratedLists)) {
        console.log('🔄 Received hydrated lists from switch:', hydratedLists.length);
        setLists(hydratedLists);
        setListsHydrated(true);
      }
    };

    window.addEventListener('companyDataHydrated', handleHydration);
    return () => {
      window.removeEventListener('companyDataHydrated', handleHydration);
    };
  }, []);

  // Contacts are fetched from API when companyHQId changes (handled above)

  // Contact Lists: Refresh from API (manual sync only)
  const refreshLists = useCallback(async () => {
    if (!companyHQId) {
      console.warn('⚠️ refreshLists called without companyHQId');
      return;
    }

    setListsHydrating(true);
    try {
      console.log('🔄 Fetching contact lists for companyHQId:', companyHQId);
      const response = await api.get('/api/contact-lists');
      
      if (response.data?.success && Array.isArray(response.data.lists)) {
        const fetchedLists = response.data.lists;
        console.log('✅ Fetched contact lists:', fetchedLists.length);
        setLists(fetchedLists);
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contactLists', JSON.stringify(fetchedLists));
        }
        setListsHydrated(true);
      } else {
        console.warn('⚠️ API response missing success or lists array:', response.data);
        const fetchedLists = response.data?.lists ?? [];
        setLists(fetchedLists);
        setListsHydrated(true);
      }
    } catch (error) {
      console.error('❌ Error fetching contact lists:', error);
      // Don't clear lists on error - keep cached data
    } finally {
      setListsHydrating(false);
    }
  }, [companyHQId]);

  // Helper: Add a new list to state and localStorage
  const addList = useCallback((list) => {
    setLists((prev) => {
      const updated = [...prev, list];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contactLists', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Update a list in state and localStorage
  const updateList = useCallback((listId, updates) => {
    setLists((prev) => {
      const updated = prev.map((list) =>
        list.id === listId ? { ...list, ...updates } : list
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contactLists', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Remove a list from state and localStorage
  const removeList = useCallback((listId) => {
    setLists((prev) => {
      const updated = prev.filter((list) => list.id !== listId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('contactLists', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

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

  const contactsContextValue = useMemo(
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

  const contactListsContextValue = useMemo(
    () => ({
      lists,
      setLists,
      companyHQId,
      hydrated: listsHydrated,
      hydrating: listsHydrating,
      refreshLists,
      addList,
      updateList,
      removeList,
    }),
    [lists, companyHQId, listsHydrated, listsHydrating, refreshLists, addList, updateList, removeList],
  );

  return (
    <ContactsContext.Provider value={contactsContextValue}>
      <ContactListsContext.Provider value={contactListsContextValue}>
        {children}
      </ContactListsContext.Provider>
    </ContactsContext.Provider>
  );
}
