'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * useOwner Hook
 * 
 * Reads owner data from localStorage (hydrated by welcome page).
 * Welcome page is the single hydration point - this hook just reads cached data.
 * 
 * @returns {Object} { ownerId, owner, companyHQId, companyHQ, memberships, loading, hydrated, error, refresh }
 */
export function useOwner() {
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Function to load data from localStorage
  const loadFromStorage = useCallback(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const storedOwnerId = localStorage.getItem('ownerId');
    const storedOwner = localStorage.getItem('owner');
    const storedCompanyHQId = localStorage.getItem('companyHQId');
    const storedCompanyHQ = localStorage.getItem('companyHQ');
    const storedMemberships = localStorage.getItem('memberships');

    if (storedOwnerId) {
      setOwnerId(storedOwnerId);
    }
    if (storedOwner) {
      try {
        const parsedOwner = JSON.parse(storedOwner);
        setOwner(parsedOwner);
        setCompanyHQId(parsedOwner.companyHQId || storedCompanyHQId || null);
        setCompanyHQ(parsedOwner.companyHQ || (storedCompanyHQ ? JSON.parse(storedCompanyHQ) : null));
        
        // Set memberships from owner or separate storage
        if (parsedOwner.memberships) {
          setMemberships(parsedOwner.memberships);
        } else if (storedMemberships) {
          setMemberships(JSON.parse(storedMemberships));
        }
        setHydrated(true);
      } catch (error) {
        console.warn('Failed to parse stored owner', error);
      }
    } else if (storedCompanyHQId) {
      setCompanyHQId(storedCompanyHQId);
    }
    if (storedCompanyHQ && !storedOwner) {
      try {
        setCompanyHQ(JSON.parse(storedCompanyHQ));
      } catch (error) {
        console.warn('Failed to parse stored companyHQ', error);
      }
    }
    if (storedMemberships && !storedOwner) {
      try {
        setMemberships(JSON.parse(storedMemberships));
      } catch (error) {
        console.warn('Failed to parse stored memberships', error);
      }
    }

    setLoading(false);
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Listen for storage changes (for cross-tab sync and context switching)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      // When companyHQId or companyHQ changes, refresh
      if (e.key === 'companyHQId' || e.key === 'companyHQ' || e.key === 'memberships') {
        console.log('🔄 Storage changed, refreshing owner context:', e.key);
        loadFromStorage();
      }
    };

    // Listen for storage events (fires when localStorage is changed in another tab)
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab changes)
    window.addEventListener('companyHQContextChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('companyHQContextChanged', handleStorageChange);
    };
  }, [loadFromStorage]);

  // Refresh function - manually reload from localStorage
  const refresh = useCallback(() => {
    console.log('🔄 Manually refreshing owner context...');
    loadFromStorage();
  }, [loadFromStorage]);

  return {
    ownerId,
    owner,
    companyHQId,
    companyHQ,
    memberships,
    loading,
    hydrated,
    error: null, // No errors - just reads from localStorage
    refresh, // Add refresh function
    // Microsoft connection status (computed server-side, no tokens in owner object)
    isMicrosoftConnected: owner?.microsoftConnected || false,
    microsoftEmail: owner?.microsoftEmail || null,
  };
}
