'use client';

import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

// Global hydration state - ensures hydration only happens once across all hook instances
let globalHydrationPromise = null;
let globalHasHydrated = false;

/**
 * useOwner Hook
 * 
 * Manages owner and companyHQId hydration from localStorage and API.
 * Hydrate uses Firebase ID from token to find owner and ALL memberships.
 * 
 * IMPORTANT: Waits for Firebase auth to initialize before calling hydrate API.
 * This prevents 401 errors when hook mounts before Firebase is ready.
 * 
 * CRITICAL: Hydration happens globally once - all hook instances share the same hydration state.
 * 
 * @returns {Object} { ownerId, owner, companyHQId, companyHQ, memberships, loading, hydrated, error }
 */
export function useOwner() {
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to load from localStorage and update state
  const loadFromLocalStorage = () => {
    if (typeof window === 'undefined') return;
    
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
  };

  // Load from localStorage first (instant)
  useEffect(() => {
    loadFromLocalStorage();
    setLoading(false);
  }, []);

  // Global hydration - only happens once across all hook instances
  useEffect(() => {
    // If already hydrated globally, just load from localStorage
    if (globalHasHydrated) {
      loadFromLocalStorage();
      return;
    }
    
    // If hydration is already in progress, wait for it then load from localStorage
    if (globalHydrationPromise) {
      globalHydrationPromise.then(() => {
        loadFromLocalStorage();
        setLoading(false);
      });
      return;
    }
    
    // Start global hydration - only one instance will execute this
    globalHydrationPromise = (async () => {
      try {
        // Wait for Firebase auth to initialize
        return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            unsubscribe(); // Only listen once
            
            if (!firebaseUser) {
              // Not authenticated - mark as hydrated (no data)
              globalHasHydrated = true;
              globalHydrationPromise = null;
              resolve();
              return;
            }
            
            try {
              console.log('🚀 useOwner: Hydrating owner (uses Firebase ID from token) - GLOBAL');
              const response = await api.get('/api/owner/hydrate');
              
              if (response.data?.success) {
                const ownerData = response.data.owner;
                const membershipsData = response.data.memberships || ownerData.memberships || [];
                
                // Set to localStorage (all instances will read from here)
                localStorage.setItem('owner', JSON.stringify(ownerData));
                localStorage.setItem('ownerId', ownerData.id);
                localStorage.setItem('memberships', JSON.stringify(membershipsData));
                
                if (ownerData.companyHQId) {
                  localStorage.setItem('companyHQId', ownerData.companyHQId);
                }
                if (ownerData.companyHQ) {
                  localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
                }

                console.log(`✅ useOwner: Hydrated with ${membershipsData.length} membership(s) - GLOBAL`);
              }
            } catch (err) {
              console.error('Error hydrating owner:', err);
              // Don't set error on 401 - that's expected when not authenticated
              if (err.response?.status !== 401) {
                setError(err.message || 'Failed to hydrate owner data');
              }
            } finally {
              globalHasHydrated = true;
              globalHydrationPromise = null;
              resolve();
            }
          });
        });
      } catch (err) {
        console.error('Error setting up hydration:', err);
        globalHasHydrated = true;
        globalHydrationPromise = null;
      }
    })();
    
    // Wait for hydration to complete, then load from localStorage
    globalHydrationPromise.then(() => {
      loadFromLocalStorage();
      setLoading(false);
    });
  }, []); // Empty deps - only run once globally

  return {
    ownerId,
    owner,
    companyHQId,
    companyHQ,
    memberships,
    loading,
    hydrated,
    error,
    // Microsoft connection status (computed server-side, no tokens in owner object)
    isMicrosoftConnected: owner?.microsoftConnected || false,
    microsoftEmail: owner?.microsoftEmail || null,
  };
}
