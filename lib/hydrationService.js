/**
 * Hydration Service
 * 
 * Handles re-hydration of company-specific data when CompanyHQ context changes
 */

/**
 * Hydrate all company-specific data for a new CompanyHQ
 * 
 * @param {string} companyHQId - The new CompanyHQ ID to hydrate
 * @returns {Promise<Object>} Hydrated data
 */
export async function hydrateCompanyData(companyHQId) {
  if (!companyHQId) {
    console.warn('⚠️ Cannot hydrate: companyHQId is required');
    return null;
  }

  console.log(`🔄 Starting hydration for CompanyHQ: ${companyHQId}`);

  try {
    // Import API client dynamically to avoid SSR issues
    const api = (await import('@/lib/api')).default;

    // Hydrate in parallel for performance
    const [contactsResponse, listsResponse] = await Promise.allSettled([
      // Hydrate contacts
      api.post('/api/contacts/hydrate', { companyHQId }).catch((err) => {
        console.warn('⚠️ Contacts hydration failed:', err);
        return { data: { success: false, contacts: [] } };
      }),
      
      // Hydrate contact lists
      api.get('/api/contact-lists').catch((err) => {
        console.warn('⚠️ Contact lists hydration failed:', err);
        return { data: { success: false, lists: [] } };
      }),
    ]);

    const contacts = contactsResponse.status === 'fulfilled' && contactsResponse.value.data?.success
      ? contactsResponse.value.data.contacts || []
      : [];

    const lists = listsResponse.status === 'fulfilled' && listsResponse.value.data?.success
      ? listsResponse.value.data.lists || []
      : [];

    // Update localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('contacts', JSON.stringify(contacts));
      window.localStorage.setItem('contactLists', JSON.stringify(lists));
      
      console.log(`✅ Hydrated ${contacts.length} contacts and ${lists.length} lists`);
    }

    // Dispatch event for components to refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('companyDataHydrated', {
        detail: {
          companyHQId,
          contacts,
          lists,
        }
      }));
    }

    return {
      contacts,
      lists,
    };
  } catch (error) {
    console.error('❌ Hydration failed:', error);
    return null;
  }
}

/**
 * Clear all company-specific data from localStorage
 * Call this when switching CompanyHQs to avoid stale data
 */
export function clearCompanyData() {
  if (typeof window === 'undefined') return;
  
  console.log('🧹 Clearing company-specific data from localStorage');
  
  // Clear company-scoped data
  window.localStorage.removeItem('contacts');
  window.localStorage.removeItem('contactLists');
  // Add other company-scoped data here as needed:
  // window.localStorage.removeItem('companies');
  // window.localStorage.removeItem('personas');
  // etc.
}

