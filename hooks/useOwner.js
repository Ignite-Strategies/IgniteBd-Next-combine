'use client';

import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

/**
 * useOwner Hook
 * 
 * Manages owner and companyHQId hydration from localStorage and API.
 * Hydrate uses Firebase ID from token to find owner and ALL memberships.
 * 
 * IMPORTANT: Waits for Firebase auth to initialize before calling hydrate API.
 * This prevents 401 errors when hook mounts before Firebase is ready.
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
  const [authInitialized, setAuthInitialized] = useState(false);
  const hasHydratedRef = useRef(false);

  // Load from localStorage first (instant)
  useEffect(() => {
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
    if (storedMemberships && !storedOwner) {
      try {
        setMemberships(JSON.parse(storedMemberships));
      } catch (error) {
        console.warn('Failed to parse stored memberships', error);
      }
    }

    setLoading(false);
  }, []);

  // Wait for Firebase auth to initialize before hydrating
  // CRITICAL: This prevents 401 errors when hook mounts before Firebase is ready
  useEffect(() => {
    // Only set up listener once
    if (hasHydratedRef.current) return;
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Only hydrate once, even if auth state changes
      if (hasHydratedRef.current) return;
      
      // Mark as initialized (whether user is logged in or not)
      setAuthInitialized(true);
      
      // Hydrate immediately when auth state is known
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        
        const hydrate = async () => {
          try {
            setLoading(true);
            console.log('🚀 useOwner: Hydrating owner (uses Firebase ID from token)');
            const response = await api.get('/api/owner/hydrate');
            
            if (response.data?.success) {
              const ownerData = response.data.owner;
              const membershipsData = response.data.memberships || ownerData.memberships || [];
              
              // Set state from full owner object
              setOwnerId(ownerData.id);
              setOwner(ownerData);
              setCompanyHQId(ownerData.companyHQId || null);
              setCompanyHQ(ownerData.companyHQ || null);
              setMemberships(membershipsData);

              // Set to localStorage
              localStorage.setItem('owner', JSON.stringify(ownerData));
              localStorage.setItem('ownerId', ownerData.id);
              localStorage.setItem('memberships', JSON.stringify(membershipsData));
              
              if (ownerData.companyHQId) {
                localStorage.setItem('companyHQId', ownerData.companyHQId);
              }
              if (ownerData.companyHQ) {
                localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
              }

              console.log(`✅ useOwner: Hydrated with ${membershipsData.length} membership(s)`);
              setHydrated(true);
            } else {
              setError(response.data?.error || 'Failed to hydrate owner');
            }
          } catch (err) {
            console.error('Error hydrating owner:', err);
            // Don't set error on 401 - that's expected when not authenticated
            if (err.response?.status !== 401) {
              setError(err.message || 'Failed to hydrate owner data');
            }
          } finally {
            setLoading(false);
          }
        };
        
        hydrate();
      }
    });

    return () => unsubscribe();
  }, []); // Empty deps - only run once on mount

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
