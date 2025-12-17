'use client';

import { createContext, useContext } from 'react';

export const OutreachContext = createContext({
  campaigns: [],
  hydrating: false,
  hydrated: false,
  refreshCampaigns: async () => {},
  setCampaigns: () => {},
});

export function useOutreachContext() {
  const context = useContext(OutreachContext);
  if (!context) {
    throw new Error('useOutreachContext must be used within OutreachLayout');
  }
  return context;
}

