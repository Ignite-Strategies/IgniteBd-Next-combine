'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

/**
 * useOwner Hook
 * 
 * Manages owner and companyHQId hydration from localStorage and API.
 * Hydrate uses Firebase ID from token to find owner - that's it.
 * 
 * @returns {Object} { ownerId, owner, companyHQId, companyHQ, loading, hydrated, error }
 */
export function useOwner() {
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState(null);
  const hasHydratedRef = useRef(false);

  // Load from localStorage first (instant)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedOwnerId = localStorage.getItem('ownerId');
    const storedOwner = localStorage.getItem('owner');
    const storedCompanyHQId = localStorage.getItem('companyHQId');
    const storedCompanyHQ = localStorage.getItem('companyHQ');

    if (storedOwnerId) {
      setOwnerId(storedOwnerId);
    }
    if (storedOwner) {
      try {
        const parsedOwner = JSON.parse(storedOwner);
        setOwner(parsedOwner);
        setCompanyHQId(parsedOwner.companyHQId || storedCompanyHQId || null);
        setCompanyHQ(parsedOwner.companyHQ || (storedCompanyHQ ? JSON.parse(storedCompanyHQ) : null));
      } catch (error) {
        console.warn('Failed to parse stored owner', error);
      }
    }
    if (storedCompanyHQId && !storedOwner) {
      setCompanyHQId(storedCompanyHQId);
    }
    if (storedCompanyHQ && !storedOwner) {
      try {
        setCompanyHQ(JSON.parse(storedCompanyHQ));
      } catch (error) {
        console.warn('Failed to parse stored companyHQ', error);
      }
    }

    setLoading(false);
  }, []);

  // Hydrate once - uses Firebase ID from token to find owner
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    const hydrate = async () => {
      try {
        setLoading(true);
        console.log('🚀 useOwner: Hydrating owner (uses Firebase ID from token)');
        const response = await api.get('/api/owner/hydrate');
        
        if (response.data?.success) {
          const ownerData = response.data.owner;
          
          // Set state from full owner object
          setOwnerId(ownerData.id);
          setOwner(ownerData);
          setCompanyHQId(ownerData.companyHQId || null);
          setCompanyHQ(ownerData.companyHQ || null);

          // Set full owner object to localStorage
          localStorage.setItem('owner', JSON.stringify(ownerData));
          localStorage.setItem('ownerId', ownerData.id);
          if (ownerData.companyHQId) {
            localStorage.setItem('companyHQId', ownerData.companyHQId);
          }
          if (ownerData.companyHQ) {
            localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
          }

          setHydrated(true);
        } else {
          setError(response.data?.error || 'Failed to hydrate owner');
        }
      } catch (err) {
        console.error('Error hydrating owner:', err);
        setError(err.message || 'Failed to hydrate owner data');
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, []);

  return {
    ownerId,
    owner,
    companyHQId,
    companyHQ,
    loading,
    hydrated,
    error,
  };
}
