/**
 * Google OAuth Utility
 * 
 * Handles OAuth2 authentication for Google Drive/Docs access.
 * Firebase Auth remains primary app auth.
 */

import { google } from 'googleapis';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
];

/**
 * Get OAuth2 client
 */
export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth consent URL
 */
export function generateGoogleAuthUrl(state?: string): string {
  const oauth2Client = getGoogleOAuthClient();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: GOOGLE_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state: state || '', // Pass-through state for CSRF
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getGoogleOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    scope: tokens.scope,
    expiryDate: tokens.expiry_date,
  };
}

/**
 * Get authenticated Google client for owner
 * 
 * @param refreshToken - Stored refresh token from database
 * @returns Authenticated OAuth2 client (auto-refreshes access token)
 */
export function getAuthenticatedGoogleClient(refreshToken: string) {
  const oauth2Client = getGoogleOAuthClient();
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  
  // OAuth2Client will auto-refresh access token when needed
  return oauth2Client;
}

/**
 * Get Google auth client for owner from database
 * 
 * @param ownerId - Owner ID
 * @returns Authenticated OAuth2 client or null if not connected
 */
export async function getGoogleAuthForOwner(ownerId: string) {
  const { prisma } = await import('@/lib/prisma');
  
  // Load refresh token from database
  const token = await prisma.googleOAuthToken.findUnique({
    where: {
      ownerId_provider: {
        ownerId,
        provider: 'google',
      },
    },
  });
  
  if (!token || !token.refreshToken) {
    return null;
  }
  
  // Create authenticated client (auto-refreshes access token)
  return getAuthenticatedGoogleClient(token.refreshToken);
}
