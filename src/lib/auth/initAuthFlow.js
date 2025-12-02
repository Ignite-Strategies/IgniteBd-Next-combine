/**
 * Unified Auth Flow - Single Source of Truth for Owner Hydration
 * 
 * This module replicates the exact logic from /welcome page:
 * - Waits for Firebase auth via onAuthStateChanged
 * - Gets ID token
 * - Calls /api/owner/hydrate
 * - Stores owner in global store
 * - Stores companyHQId in localStorage
 * 
 * ⚠️ This is the ONLY place that should call /api/owner/hydrate
 */

'use client';

import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { useOwnerStore } from '@/stores/ownerStore';

/**
 * Initialize auth flow - waits for Firebase user and hydrates owner
 * @returns {Promise<{owner: Object, companyHQId: string|null}>}
 */
export async function initAuthFlow() {
  return new Promise((resolve, reject) => {
    // Wait for Firebase auth to initialize
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        unsubscribe();
        reject(new Error('No Firebase user found'));
        return;
      }

      try {
        console.log('✅ initAuthFlow: Firebase user found:', firebaseUser.uid);
        
        // Get ID token (ensures it's fresh)
        const token = await firebaseUser.getIdToken();
        console.log('✅ initAuthFlow: Token obtained');

        // Call hydrate API (token automatically added by axios interceptor)
        console.log('🚀 initAuthFlow: Calling /api/owner/hydrate');
        const response = await api.get('/api/owner/hydrate');

        if (!response.data?.success) {
          throw new Error(response.data?.error || 'Failed to hydrate owner');
        }

        const ownerData = response.data.owner;
        const isSuperAdmin = response.data.isSuperAdmin === true;

        console.log('✅ initAuthFlow: Owner hydrated:', ownerData.id);

        // Update global store
        const store = useOwnerStore.getState();
        store.setOwner({
          id: ownerData.id,
          firebaseId: ownerData.firebaseId,
          name: ownerData.name,
          email: ownerData.email,
          photoURL: ownerData.photoURL,
          companyHQId: ownerData.companyHQId || null,
          companyHQ: ownerData.companyHQ || null,
          ownedCompanies: ownerData.ownedCompanies || [],
          managedCompanies: ownerData.managedCompanies || [],
          isSuperAdmin: isSuperAdmin,
        });

        // Update localStorage
        if (typeof window !== 'undefined') {
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
        }

        unsubscribe();
        resolve({
          owner: ownerData,
          companyHQId: ownerData.companyHQId || null,
          isSuperAdmin: isSuperAdmin,
        });
      } catch (error) {
        console.error('❌ initAuthFlow: Error:', error);
        unsubscribe();
        reject(error);
      }
    });
  });
}

