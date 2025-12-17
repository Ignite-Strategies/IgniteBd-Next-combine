'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

/**
 * useCompanyHQ Hook
 * 
 * Manages companyHQId hydration from localStorage.
 * Provides surgical hydration point for company data.
 * 
 * @returns {Object} { companyHQId, companyHQ, loading, hydrated, refresh }
 */
export function useCompanyHQ() {
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId = localStorage.getItem('companyHQId');
    const storedCompanyHQ = localStorage.getItem('companyHQ');

    if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
    }
    if (storedCompanyHQ) {
      try {
        setCompanyHQ(JSON.parse(storedCompanyHQ));
        setHydrated(true);
      } catch (error) {
        console.warn('Failed to parse stored companyHQ', error);
      }
    }
  }, []);

  // Refresh from owner hydration (gets latest companyHQ)
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/owner/hydrate');
      if (response.data?.success) {
        const ownerData = response.data.owner;
        const newCompanyHQId = ownerData.companyHQId || null;
        const newCompanyHQ = ownerData.companyHQ || null;

        setCompanyHQId(newCompanyHQId);
        setCompanyHQ(newCompanyHQ);

        if (newCompanyHQId) {
          localStorage.setItem('companyHQId', newCompanyHQId);
        }
        if (newCompanyHQ) {
          localStorage.setItem('companyHQ', JSON.stringify(newCompanyHQ));
        }

        setHydrated(true);
      }
    } catch (error) {
      console.error('Error refreshing companyHQ:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    companyHQId,
    companyHQ,
    loading,
    hydrated,
    refresh,
  };
}

