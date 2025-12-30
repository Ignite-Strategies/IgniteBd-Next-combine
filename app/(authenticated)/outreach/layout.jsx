'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { OutreachContext } from './OutreachContext';

function OutreachLayoutContent({ children }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Auto-redirect if companyHQId missing from URL but exists in localStorage
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
      if (stored) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('companyHQId', stored);
        router.replace(currentUrl.pathname + currentUrl.search);
      }
    }
  }, [companyHQId, router]);
  
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

export default function OutreachLayout({ children }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OutreachLayoutContent>{children}</OutreachLayoutContent>
    </Suspense>
  );
}
