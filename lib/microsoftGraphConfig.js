/**
 * Microsoft Graph Configuration
 * 
 * Environment variables needed:
 * - NEXT_PUBLIC_AZURE_CLIENT_ID: Your Azure AD App Registration Client ID
 * - NEXT_PUBLIC_AZURE_AUTHORITY: Azure AD Authority (optional, defaults to common)
 *   Examples:
 *     - https://login.microsoftonline.com/common (multi-tenant)
 *     - https://login.microsoftonline.com/{tenant-id} (single-tenant)
 *     - https://login.microsoftonline.com/organizations (organizations only)
 */

export const graphConfig = {
  clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
  authority: process.env.NEXT_PUBLIC_AZURE_AUTHORITY || 'https://login.microsoftonline.com/common',
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  
  // Default scopes for Microsoft Graph API
  scopes: [
    'User.Read',
    'Contacts.Read',
    'Contacts.ReadWrite',
    'Mail.Read',
    'Mail.Send',
    'Calendars.Read',
    'Calendars.ReadWrite',
  ],
};

// Check if configuration is valid
export function isGraphConfigValid() {
  return !!graphConfig.clientId;
}

