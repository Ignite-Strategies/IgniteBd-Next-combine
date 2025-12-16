/**
 * Google Service Account Client - SERVER-ONLY
 * 
 * ⚠️ NEVER import this file in client components or client-side code
 * Only use in /app/api routes or other server modules
 * 
 * Provides authenticated Google API client for Google Docs, Drive, etc.
 */

import { google } from 'googleapis';

let authClient = null;

/**
 * Get authenticated Google API client
 * @returns {google.auth.JWT} Authenticated JWT client
 */
export function getGoogleAuthClient() {
  if (authClient) {
    return authClient;
  }

  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.warn('⚠️ Google service account not initialized: GOOGLE_SERVICE_ACCOUNT_JSON missing');
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    authClient = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    console.log('✅ Google Service Account initialized');
    return authClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google Service Account:', error.message);
    return null;
  }
}

/**
 * Get Google Docs API client
 * @returns {google.docs.docs} Google Docs API client
 */
export function getGoogleDocsClient() {
  const auth = getGoogleAuthClient();
  if (!auth) {
    throw new Error('Google service account not initialized. Check GOOGLE_SERVICE_ACCOUNT_JSON.');
  }
  return google.docs({ version: 'v1', auth });
}

/**
 * Get Google Drive API client
 * @returns {google.drive.drive} Google Drive API client
 */
export function getGoogleDriveClient() {
  const auth = getGoogleAuthClient();
  if (!auth) {
    throw new Error('Google service account not initialized. Check GOOGLE_SERVICE_ACCOUNT_JSON.');
  }
  return google.drive({ version: 'v3', auth });
}

/**
 * Initialize and authenticate the service account
 * Call this before making API requests if you need to ensure authentication
 */
export async function initializeGoogleAuth() {
  const auth = getGoogleAuthClient();
  if (auth) {
    await auth.authorize();
    return auth;
  }
  return null;
}

