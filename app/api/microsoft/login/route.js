import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { assertValidMicrosoftOAuthConfig, getMicrosoftClientId, getMicrosoftAuthority } from '@/lib/microsoftOAuthGuardrails';

/**
 * GET /api/microsoft/login
 * 
 * Initiates Microsoft OAuth Authorization Code Flow
 * 
 * IMPORTANT: This endpoint does NOT require authentication tokens.
 * OAuth Authorization Code Flow works like this:
 * 1. User clicks "Connect Microsoft" → redirects to Microsoft
 * 2. User authenticates with Microsoft
 * 3. Microsoft redirects back with ?code=XYZ (authorization code, NOT a token)
 * 4. /api/microsoft/callback exchanges the code for access_token + refresh_token
 * 
 * We cannot have access_token before step 4. Expecting a token here is architecturally wrong.
 * 
 * Optional query params:
 * - ownerId: If provided, will be encoded in state parameter for callback to identify user
 *            If not provided, callback will find owner by Microsoft email
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerIdParam = searchParams.get('ownerId');

    // Generate state parameter for CSRF protection
    // State can optionally include ownerId, but it's not required
    // If ownerId is provided, encode it in state for callback to use
    // If not provided, callback will find owner by Microsoft email after token exchange
    const state = crypto.randomBytes(32).toString('base64url');
    
    let stateData = {
      timestamp: Date.now(),
    };
    
    // Optionally include ownerId in state if provided
    // This helps callback identify which owner to save tokens for
    // But callback can also find owner by Microsoft email as fallback
    if (ownerIdParam) {
      stateData.ownerId = ownerIdParam;
    }
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Get validated OAuth configuration
    // CRITICAL: Must use AZURE_CLIENT_ID, never AZURE_TENANT_ID
    // Authority must be "common" for multi-tenant support (personal + work/school accounts)
    const clientId = getMicrosoftClientId();
    const authority = getMicrosoftAuthority();
    
    // Runtime assertion: Fail fast if configuration is wrong
    // This prevents silent failures where personal accounts can't sign in
    assertValidMicrosoftOAuthConfig(clientId, authority);

    // Build Microsoft OAuth authorization URL
    // IMPORTANT: Microsoft OAuth uses Authorization Code Flow:
    // 1. User authenticates with Microsoft → Microsoft redirects back with ?code= (authorization code)
    // 2. We exchange the code server-side for access_token + refresh_token
    // Microsoft NEVER sends access_token directly in the redirect
    // 
    // SERVER-SIDE ONLY: This redirectUri must match exactly in callback route
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'User.Read',
      'Mail.Send',
      'Mail.Read',
      'Contacts.Read',
      'Contacts.ReadWrite',
      'Calendars.Read',
    ].join(' ');
    
    const params = new URLSearchParams({
      client_id: clientId, // Validated: Must be AZURE_CLIENT_ID, never AZURE_TENANT_ID
      response_type: 'code', // Authorization Code Flow - Microsoft returns ?code=, NOT access_token
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
      state: encodedState,
    });

    const authUrl = `${authority}/oauth2/v2.0/authorize?${params}`;

    // Always redirect to Microsoft OAuth
    // This is a redirect-only endpoint - it never returns JSON
    // The redirect happens in the browser, Microsoft authenticates the user,
    // then Microsoft redirects back to /api/microsoft/callback with ?code=
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth login error:', error);
    const appUrl = process.env.APP_URL || 'https://app.ignitegrowth.biz';
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(error.message || 'Failed to initiate OAuth flow')}`
    );
  }
}

