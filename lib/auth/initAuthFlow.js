/**
 * ⚠️ DEPRECATED - DO NOT USE
 * 
 * This module is deprecated and causes collisions with welcome page.
 * The welcome page is now the single source of truth for setting companyHQId.
 * 
 * This was causing issues where:
 * - It would remove companyHQId if owner doesn't have one
 * - It conflicts with welcome page's companyHQId resolution
 * - The wiper breaks the entire stack
 * 
 * Use /welcome page instead for owner hydration and companyHQId setting.
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
        // ⚠️ CRITICAL: Don't remove companyHQId if it already exists and owner doesn't have one
        // This can happen when user has memberships but hasn't selected one yet
        // The companyHQId should only be set/removed by the welcome page
        if (typeof window !== 'undefined') {
          localStorage.setItem('ownerId', ownerData.id);
          localStorage.setItem('owner', JSON.stringify(ownerData));
          
          // Only set companyHQId if owner has one - don't remove existing one
          if (ownerData.companyHQId) {
            localStorage.setItem('companyHQId', ownerData.companyHQId);
          }
          // Don't remove companyHQId if owner doesn't have one - it might be set from welcome page
          
          if (ownerData.companyHQ) {
            localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
          }
          // Don't remove companyHQ if owner doesn't have one - it might be set from welcome page
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

