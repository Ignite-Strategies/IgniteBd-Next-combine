'use client';

import { createContext, useContext } from 'react';

export const ContactListsContext = createContext({
  lists: [],
  setLists: () => {},
  companyHQId: '',
  hydrated: false,
  hydrating: false,
  refreshLists: async () => {},
  addList: (list) => {},
  updateList: (listId, updates) => {},
  removeList: (listId) => {},
});

export function useContactLists() {
  const context = useContext(ContactListsContext);
  if (!context) {
    throw new Error('useContactLists must be used within ContactsLayout');
  }
  return context;
}

