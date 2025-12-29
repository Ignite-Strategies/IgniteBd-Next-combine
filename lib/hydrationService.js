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
        console.error('❌ Contacts hydration failed:', err);
        console.error('❌ Error details:', err.response?.data || err.message);
        return { data: { success: false, contacts: [] } };
      }),
      
      // Hydrate contact lists (requires companyHQId as query param)
      api.get(`/api/contact-lists?companyHQId=${companyHQId}`).catch((err) => {
        console.error('❌ Contact lists hydration failed:', err);
        console.error('❌ Error details:', err.response?.data || err.message);
        return { data: { success: false, lists: [] } };
      }),
    ]);

    // Check contacts response
    let contacts = [];
    if (contactsResponse.status === 'fulfilled') {
      if (contactsResponse.value.data?.success) {
        contacts = contactsResponse.value.data.contacts || [];
        console.log(`✅ Contacts hydrated: ${contacts.length}`);
      } else {
        console.warn('⚠️ Contacts response not successful:', contactsResponse.value.data);
      }
    } else {
      console.error('❌ Contacts promise rejected:', contactsResponse.reason);
    }

    // Check lists response
    let lists = [];
    if (listsResponse.status === 'fulfilled') {
      if (listsResponse.value.data?.success) {
        lists = listsResponse.value.data.lists || [];
        console.log(`✅ Contact lists hydrated: ${lists.length}`);
      } else {
        console.warn('⚠️ Contact lists response not successful:', listsResponse.value.data);
        console.warn('⚠️ Full response:', JSON.stringify(listsResponse.value.data, null, 2));
      }
    } else {
      console.error('❌ Contact lists promise rejected:', listsResponse.reason);
    }

    // Update localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('contacts', JSON.stringify(contacts));
      window.localStorage.setItem('contactLists', JSON.stringify(lists));
      
      console.log(`✅ Hydration complete: ${contacts.length} contacts and ${lists.length} lists stored`);
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

