/**
 * Global Owner Store - Single Source of Truth
 * 
 * This store holds the authenticated owner data.
 * It is populated by the /welcome page during owner hydration.
 * 
 * Components should read from this store, never call hydrate API directly.
 * The /welcome page is the single source of truth for setting companyHQId.
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useOwnerStore = create(
  persist(
    (set) => ({
      owner: null,
      hydrated: false,
      
      setOwner: (ownerData) => {
        set({
          owner: ownerData,
          hydrated: true,
        });
      },
      
      // TODO WEDNESDAY FIX #1: clearOwner() is called during tenant hydration to reset tenant-scoped owner data
      clearOwner: () => {
        set({
          owner: null,
          hydrated: false,
        });
      },
    }),
    {
      name: 'owner-store',
      // Only persist owner data, not hydrated flag (always check on mount)
    }
  )
);

export { useOwnerStore };

