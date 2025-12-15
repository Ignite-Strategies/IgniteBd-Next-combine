'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';

/**
 * useOwner Hook
 * 
 * Manages owner and companyHQId hydration from localStorage and API.
 * Provides surgical hydration point for owner data.
 * 
 * @returns {Object} { ownerId, owner, companyHQId, companyHQ, loading, hydrated, refresh }
 */
export function useOwner() {
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const isRefreshingRef = useRef(false);

  // Wait for Firebase auth to initialize
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('✅ useOwner: Firebase auth initialized, user:', firebaseUser.uid);
        setAuthInitialized(true);
      } else {
        console.log('⚠️ useOwner: No Firebase user');
        setAuthInitialized(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load from localStorage on mount
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
        setOwner(JSON.parse(storedOwner));
      } catch (error) {
        console.warn('Failed to parse stored owner', error);
      }
    }
    if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
    }
    if (storedCompanyHQ) {
      try {
        setCompanyHQ(JSON.parse(storedCompanyHQ));
      } catch (error) {
        console.warn('Failed to parse stored companyHQ', error);
      }
    }

    // If we have data in localStorage, mark as hydrated
    if (storedOwnerId) {
      setHydrated(true);
      setLoading(false);
    }
  }, []);

  // Refresh from API
  const refresh = useCallback(async () => {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshingRef.current) {
      console.log('⏸️ useOwner: Refresh already in progress, skipping...');
      return;
    }

    try {
      isRefreshingRef.current = true;
      setLoading(true);
      setError(null);

      // Wait for auth to be initialized
      if (!authInitialized) {
        console.log('⏳ useOwner: Waiting for auth initialization...');
        setLoading(false);
        isRefreshingRef.current = false;
        return;
      }

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('No Firebase user found');
        setLoading(false);
        isRefreshingRef.current = false;
        return;
      }

      console.log('🚀 useOwner: Calling /api/owner/hydrate');
      const response = await api.get('/api/owner/hydrate');
      if (!response.data?.success) {
        setError(response.data?.error || 'Failed to hydrate owner');
        setLoading(false);
        return;
      }

      const ownerData = response.data.owner;

      // Update state
      setOwnerId(ownerData.id);
      setOwner(ownerData);
      setCompanyHQId(ownerData.companyHQId || null);
      setCompanyHQ(ownerData.companyHQ || null);

      // Update localStorage
      localStorage.setItem('ownerId', ownerData.id);
      localStorage.setItem('owner', JSON.stringify(ownerData));
      if (ownerData.companyHQId) {
        localStorage.setItem('companyHQId', ownerData.companyHQId);
      } else {
        localStorage.removeItem('companyHQId');
      }
      if (ownerData.companyHQ) {
        localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
      } else {
        localStorage.removeItem('companyHQ');
      }

      setHydrated(true);
      setLoading(false);
    } catch (err) {
      console.error('Error refreshing owner:', err);
      setError(err.message || 'Failed to refresh owner data');
      setLoading(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [authInitialized]);

  return {
    ownerId,
    owner,
    companyHQId,
    companyHQ,
    loading,
    hydrated,
    error,
    refresh,
  };
}

