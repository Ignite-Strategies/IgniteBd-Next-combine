import { useState, useCallback, useEffect } from 'react';
import { 
  getMsalInstance, 
  ensureMsalInitialized,
  getAccessToken, 
  loginRequest,
  graphService 
} from '@/lib/microsoftGraph';
import { isGraphConfigValid } from '@/lib/microsoftGraphConfig';

// Custom hook for Microsoft Graph operations
export const useMicrosoftGraph = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Load user profile
  const loadUserProfile = useCallback(async () => {
    try {
      const profile = await graphService.getUserProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      console.error('Failed to load user profile:', err);
      return null;
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!isGraphConfigValid()) {
      setError('Microsoft Graph configuration is missing. Please set NEXT_PUBLIC_AZURE_CLIENT_ID in your environment variables.');
      return;
    }

    const checkAuth = async () => {
      const msal = await ensureMsalInitialized();
      if (msal) {
        const accounts = msal.getAllAccounts();
        setIsAuthenticated(accounts.length > 0);
        
        if (accounts.length > 0) {
          // Load user profile if authenticated
          loadUserProfile();
        }
      }
    };
    
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadUserProfile has no dependencies, is stable - only run once on mount

  // Sign in with Microsoft
  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isGraphConfigValid()) {
        throw new Error('Microsoft Graph configuration is missing. Please set NEXT_PUBLIC_AZURE_CLIENT_ID in your environment variables.');
      }

      const msal = await ensureMsalInitialized();
      if (!msal) {
        throw new Error('MSAL instance not available');
      }

      const response = await msal.loginPopup(loginRequest);
      setIsAuthenticated(true);
      
      // Load user profile after sign in
      await loadUserProfile();
      
      return { success: true, account: response.account };
    } catch (err) {
      const errorMessage = err.message || 'Failed to sign in with Microsoft';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  // Sign out
  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const msal = await ensureMsalInitialized();
      if (msal) {
        const accounts = msal.getAllAccounts();
        if (accounts.length > 0) {
          await msal.logoutPopup({ account: accounts[0] });
        }
        setIsAuthenticated(false);
        setUser(null);
      }
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate contacts from Microsoft Graph
  const hydrateContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated) {
        throw new Error('Please sign in with Microsoft first');
      }

      const contacts = await graphService.getContacts();
      
      return {
        success: true,
        contacts: contacts.value || contacts,
        count: contacts.value?.length || contacts.length || 0
      };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch contacts from Microsoft Graph';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Send message via Microsoft Graph
  const sendMessage = useCallback(async (message) => {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated) {
        throw new Error('Please sign in with Microsoft first');
      }

      if (!message.subject || !message.body || !message.toRecipients) {
        throw new Error('Message must include subject, body, and toRecipients');
      }

      await graphService.sendMail(message);
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Failed to send message via Microsoft Graph';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Get calendar events
  const getCalendarEvents = useCallback(async (startDateTime, endDateTime) => {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated) {
        throw new Error('Please sign in with Microsoft first');
      }

      const events = await graphService.getCalendarEvents(startDateTime, endDateTime);
      return {
        success: true,
        events: events.value || events
      };
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch calendar events';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Create contact
  const createContact = useCallback(async (contactData) => {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated) {
        throw new Error('Please sign in with Microsoft first');
      }

      const contact = await graphService.createContact(contactData);
      return { success: true, contact };
    } catch (err) {
      const errorMessage = err.message || 'Failed to create contact';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  return {
    // Authentication
    signIn,
    signOut,
    isAuthenticated,
    user,
    
    // Contacts
    hydrateContacts,
    createContact,
    
    // Messaging
    sendMessage,
    
    // Calendar
    getCalendarEvents,
    
    // State
    loading,
    error,
  };
};

