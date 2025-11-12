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

const OutreachContext = createContext({
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

export default function OutreachLayout({ children }) {
  const [campaigns, setCampaigns] = useState([]);
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cached = window.localStorage.getItem('outreachCampaigns');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setCampaigns(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Unable to parse cached outreach campaigns', error);
      }
    }
  }, []);

  const refreshCampaigns = useCallback(async () => {
    try {
      setHydrating(true);
      const response = await api.get('/api/outreach/campaigns');
      const data = Array.isArray(response.data?.campaigns)
        ? response.data.campaigns
        : [];
      setCampaigns(data);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('outreachCampaigns', JSON.stringify(data));
      }
      setHydrated(true);
    } catch (error) {
      console.warn('Outreach campaigns API unavailable.', error);
      setHydrated(true);
    } finally {
      setHydrating(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      campaigns,
      hydrating,
      hydrated,
      refreshCampaigns,
      setCampaigns,
    }),
    [campaigns, hydrating, hydrated, refreshCampaigns, setCampaigns],
  );

  return <OutreachContext.Provider value={value}>{children}</OutreachContext.Provider>;
}
