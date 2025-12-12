'use client';

import { createContext, useContext } from 'react';

export const ContactsContext = createContext({
  contacts: [],
  setContacts: () => {},
  companyHQId: '',
  hydrated: false,
  hydrating: false,
  refreshContacts: async () => {},
  updateContact: (contactId, updates) => {},
  addContact: (contact) => {},
  removeContact: (contactId) => {},
});

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within ContactsLayout');
  }
  return context;
}

// Alias for backward compatibility
export function useContactsContext() {
  return useContacts();
}

