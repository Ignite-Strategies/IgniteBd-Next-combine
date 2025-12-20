import { ConfidentialClientApplication } from '@azure/msal-node';
import { prisma } from './prisma';

/**
 * Microsoft Graph Client Helper
 * 
 * Provides utilities for interacting with Microsoft Graph API
 * Handles token refresh automatically
 */

/**
 * Get valid access token for an owner
 * Automatically refreshes token if expired
 */
export async function getValidAccessToken(ownerId) {
  try {
    // Get Owner record with Microsoft auth fields
    const owner = await prisma.owners.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
      },
    });

    if (!owner || !owner.microsoftAccessToken) {
      throw new Error('Microsoft account not connected');
    }

    // Check if token is expired (with 5 minute buffer)
    const now = new Date();
    const expiresAt = owner.microsoftExpiresAt ? new Date(owner.microsoftExpiresAt) : null;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (!expiresAt || (expiresAt.getTime() - now.getTime() < bufferTime)) {
      // Token is expired or about to expire, refresh it
      console.log('Token expired or expiring soon, refreshing...');
      return await refreshAccessToken(ownerId);
    }

    return owner.microsoftAccessToken;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(ownerId) {
  try {
    const owner = await prisma.owners.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
        microsoftTenantId: true, // Get tenant ID from user record
      },
    });

    if (!owner || !owner.microsoftAccessToken) {
      throw new Error('Microsoft account not connected');
    }

    if (!owner.microsoftRefreshToken) {
      throw new Error('No refresh token available. Please reconnect your Microsoft account.');
    }

    // MSAL configuration for token refresh
    // 
    // IMPORTANT: This function uses tenant-specific authority for token refresh
    // This is DIFFERENT from the initial OAuth flow (login/callback) which uses "common"
    // 
    // Why tenant-specific authority for refresh:
    // - After initial OAuth, we know the user's tenant ID (from ID token)
    // - Using tenant-specific authority for refresh is more efficient and reliable
    // - This is ONLY for refresh - initial login/callback MUST use "common"
    //
    // CRITICAL: clientId must be AZURE_CLIENT_ID, never AZURE_TENANT_ID
    // Tenant ID is used in the authority URL path, NOT as client_id
    const tenantId = owner.microsoftTenantId || 'common';
    const clientId = process.env.AZURE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('AZURE_CLIENT_ID environment variable is required');
    }
    
    // Guardrail: Ensure clientId is not accidentally set to tenant ID
    const tenantIdEnv = process.env.AZURE_TENANT_ID;
    if (tenantIdEnv && clientId === tenantIdEnv) {
      throw new Error(
        'Configuration error: AZURE_CLIENT_ID equals AZURE_TENANT_ID. ' +
        'Client ID identifies the app registration, tenant ID identifies the organization. ' +
        'These must be different values.'
      );
    }
    
    const msalConfig = {
      auth: {
        clientId: clientId, // Must be AZURE_CLIENT_ID (app registration ID)
        authority: `https://login.microsoftonline.com/${tenantId}`, // Tenant ID in URL path (user's org)
        clientSecret: process.env.AZURE_CLIENT_SECRET,
      },
    };

    const cca = new ConfidentialClientApplication(msalConfig);

    // Refresh the token
    // Use the same scopes as the initial authorization
    const tokenResponse = await cca.acquireTokenByRefreshToken({
      refreshToken: owner.microsoftRefreshToken,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Send', 'Mail.Read', 'Contacts.Read', 'Contacts.ReadWrite', 'Calendars.Read'],
    });

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error('Failed to refresh token');
    }

    // Calculate new expiration
    const expiresAt = new Date(Date.now() + (tokenResponse.expiresIn || 3600) * 1000);

    // Update tokens directly on Owner model
    await prisma.owners.update({
      where: { id: ownerId },
      data: {
        microsoftAccessToken: tokenResponse.accessToken,
        microsoftRefreshToken: tokenResponse.refreshToken || owner.microsoftRefreshToken,
        microsoftExpiresAt: expiresAt,
      },
    });

    console.log('✅ Access token refreshed for owner:', ownerId);

    return tokenResponse.accessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

/**
 * Send email via Microsoft Graph
 */
export async function sendMail(ownerId, mailData) {
  try {
    const accessToken = await getValidAccessToken(ownerId);

    const message = {
      message: {
        subject: mailData.subject,
        body: {
          contentType: mailData.contentType || 'HTML',
          content: mailData.body,
        },
        toRecipients: (mailData.toRecipients || []).map((email) => ({
          emailAddress: {
            address: email,
          },
        })),
        ...(mailData.ccRecipients && mailData.ccRecipients.length > 0 && {
          ccRecipients: mailData.ccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
        ...(mailData.bccRecipients && mailData.bccRecipients.length > 0 && {
          bccRecipients: mailData.bccRecipients.map((email) => ({
            emailAddress: {
              address: email,
            },
          })),
        }),
        ...(mailData.replyTo && {
          replyTo: [
            {
              emailAddress: {
                address: mailData.replyTo,
              },
            },
          ],
        }),
      },
      ...(mailData.saveToSentItems !== undefined && {
        saveToSentItems: mailData.saveToSentItems,
      }),
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send email');
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending email via Microsoft Graph:', error);
    throw error;
  }
}

/**
 * Get contacts from Microsoft Graph
 */
export async function getContacts(ownerId, options = {}) {
  try {
    const accessToken = await getValidAccessToken(ownerId);

    const { top = 100, skip = 0, filter } = options;
    let url = `https://graph.microsoft.com/v1.0/me/contacts?$top=${top}&$skip=${skip}`;
    
    if (filter) {
      url += `&$filter=${encodeURIComponent(filter)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch contacts');
    }

    const data = await response.json();
    return {
      contacts: data.value || [],
      count: data.value?.length || 0,
      nextLink: data['@odata.nextLink'],
    };
  } catch (error) {
    console.error('Error fetching contacts from Microsoft Graph:', error);
    throw error;
  }
}

/**
 * Get user profile from Microsoft Graph
 */
export async function getUserProfile(ownerId) {
  try {
    const accessToken = await getValidAccessToken(ownerId);

    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch user profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile from Microsoft Graph:', error);
    throw error;
  }
}

/**
 * Get calendar events from Microsoft Graph
 */
export async function getCalendarEvents(ownerId, options = {}) {
  try {
    const accessToken = await getValidAccessToken(ownerId);

    const { startDateTime, endDateTime, top = 100 } = options;
    let url = 'https://graph.microsoft.com/v1.0/me/events';

    if (startDateTime && endDateTime) {
      url = `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`;
    }

    url += `&$top=${top}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch calendar events');
    }

    const data = await response.json();
    return {
      events: data.value || [],
      count: data.value?.length || 0,
      nextLink: data['@odata.nextLink'],
    };
  } catch (error) {
    console.error('Error fetching calendar events from Microsoft Graph:', error);
    throw error;
  }
}

/**
 * Check if Microsoft account is connected for an owner
 */
export async function isMicrosoftConnected(ownerId) {
  try {
    const owner = await prisma.owners.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
      },
    });

    if (!owner || !owner.microsoftAccessToken) {
      return false;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = owner.microsoftExpiresAt ? new Date(owner.microsoftExpiresAt) : null;

    // If expired, try to refresh
    if (!expiresAt || expiresAt < now) {
      try {
        await refreshAccessToken(ownerId);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking Microsoft connection:', error);
    return false;
  }
}

