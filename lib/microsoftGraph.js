'use client';

import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication } from '@azure/msal-browser';
import { graphConfig, isGraphConfigValid } from './microsoftGraphConfig';

// MSAL configuration
export const msalConfig = {
  auth: {
    clientId: graphConfig.clientId,
    authority: graphConfig.authority,
    redirectUri: graphConfig.redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

// Login request with scopes
export const loginRequest = {
  scopes: graphConfig.scopes,
};

// Create MSAL instance
let msalInstance = null;
let msalInitPromise = null;

export function getMsalInstance() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    // Initialize MSAL (returns a promise)
    msalInitPromise = msalInstance.initialize();
  }

  return msalInstance;
}

// Ensure MSAL is initialized before use
export async function ensureMsalInitialized() {
  const msal = getMsalInstance();
  if (msal && msalInitPromise) {
    await msalInitPromise;
  }
  return msal;
}

// Get access token
export async function getAccessToken() {
  const msal = await ensureMsalInitialized();
  if (!msal) {
    throw new Error('MSAL instance not available');
  }

  const accounts = msal.getAllAccounts();
  
  if (accounts.length === 0) {
    throw new Error('No accounts found. Please sign in first.');
  }

  try {
    const response = await msal.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });

    return response.accessToken;
  } catch (error) {
    // If silent token acquisition fails, try interactive
    if (error.errorCode === 'interaction_required' || error.errorCode === 'consent_required') {
      const response = await msal.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
    throw error;
  }
}

// Create Microsoft Graph client
export function getGraphClient() {
  const authProvider = async (done) => {
    try {
      const token = await getAccessToken();
      done(null, token);
    } catch (error) {
      done(error, null);
    }
  };

  return Client.initWithMiddleware({ authProvider });
}

// Microsoft Graph API methods
export const graphService = {
  // Get user profile
  async getUserProfile() {
    const client = getGraphClient();
    return await client.api('/me').get();
  },

  // Get contacts
  async getContacts() {
    const client = getGraphClient();
    return await client.api('/me/contacts').get();
  },

  // Get contact by ID
  async getContact(contactId) {
    const client = getGraphClient();
    return await client.api(`/me/contacts/${contactId}`).get();
  },

  // Create contact
  async createContact(contactData) {
    const client = getGraphClient();
    return await client.api('/me/contacts').post(contactData);
  },

  // Update contact
  async updateContact(contactId, contactData) {
    const client = getGraphClient();
    return await client.api(`/me/contacts/${contactId}`).patch(contactData);
  },

  // Delete contact
  async deleteContact(contactId) {
    const client = getGraphClient();
    return await client.api(`/me/contacts/${contactId}`).delete();
  },

  // Send email
  async sendMail(message) {
    const client = getGraphClient();
    return await client.api('/me/sendMail').post({
      message: {
        subject: message.subject,
        body: {
          contentType: message.contentType || 'HTML',
          content: message.body,
        },
        toRecipients: message.toRecipients.map((email) => ({
          emailAddress: {
            address: email,
          },
        })),
        ...(message.ccRecipients && {
          ccRecipients: message.ccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
        ...(message.bccRecipients && {
          bccRecipients: message.bccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
      },
    });
  },

  // Get messages
  async getMessages() {
    const client = getGraphClient();
    return await client.api('/me/messages').get();
  },

  // Get calendar events
  async getCalendarEvents(startDateTime, endDateTime) {
    const client = getGraphClient();
    const queryParams = new URLSearchParams();
    if (startDateTime) queryParams.append('startDateTime', startDateTime);
    if (endDateTime) queryParams.append('endDateTime', endDateTime);
    
    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `/me/calendar/calendarView?${queryString}`
      : '/me/events';
    
    return await client.api(endpoint).get();
  },

  // Create calendar event
  async createCalendarEvent(eventData) {
    const client = getGraphClient();
    return await client.api('/me/events').post(eventData);
  },

  // Get mail folders
  async getMailFolders() {
    const client = getGraphClient();
    return await client.api('/me/mailFolders').get();
  },
};

