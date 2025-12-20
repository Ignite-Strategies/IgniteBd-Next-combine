import { NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { prisma } from '@/lib/prisma';
import { assertValidMicrosoftOAuthConfig, getMicrosoftClientId, getMicrosoftAuthority } from '@/lib/microsoftOAuthGuardrails';

/**
 * GET /api/microsoft/callback
 * 
 * SERVER-SIDE ONLY: This is a Next.js App Router API route
 * Handles Microsoft OAuth callback - exchanges authorization code for tokens
 * 
 * IMPORTANT: This route runs entirely server-side:
 * - No 'use client' directive (defaults to server component)
 * - Uses Next.js App Router request object
 * - Accesses environment variables server-side only
 * - Performs database operations server-side
 * 
 * Flow:
 * 1. Microsoft redirects here with ?code= (authorization code)
 * 2. We exchange code for access_token + refresh_token (server-side)
 * 3. Store tokens in database
 * 4. Redirect user to app UI
 */
export async function GET(request) {
  // Get app URL from request origin (server-side)
  // This is the base URL where we redirect back to frontend after OAuth
  // We can derive it from the request instead of needing APP_URL env var
  const appUrl = process.env.APP_URL || 
    (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
  
  try {
    // Next.js App Router: Use request.nextUrl.searchParams (not new URL(req.url))
    // This is the recommended pattern for App Router API routes
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');
    const errorDescription = request.nextUrl.searchParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(error)}`
      );
    }

    // CRITICAL: Microsoft OAuth uses Authorization Code Flow
    // Microsoft redirects back with ?code= (authorization code), NOT access_token
    // The code is a one-time use token that we exchange server-side for real tokens
    // 
    // Why Microsoft returns code, not token:
    // - Security: Access tokens never appear in browser URL or redirect
    // - Server-side exchange requires client_secret (kept secret on server)
    // - Code is single-use and short-lived (prevents replay attacks)
    if (!code) {
      console.error('❌ No authorization code provided in callback');
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=no_authorization_code_provided`
      );
    }

    // Decode state to get ownerId (if present)
    let ownerId = null;
    try {
      if (state) {
        const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
        ownerId = stateData.ownerId;
        
        // Verify state is recent (within 10 minutes)
        if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
          throw new Error('State expired');
        }
      }
    } catch (err) {
      console.warn('State parameter missing or invalid (will try to find owner by email):', err);
      // Continue - we'll try to find owner by email
    }

    // Get validated OAuth configuration
    // CRITICAL: Must use AZURE_CLIENT_ID, never AZURE_TENANT_ID
    // Authority must be "common" for token exchange (matches login endpoint)
    const clientId = getMicrosoftClientId();
    const authority = getMicrosoftAuthority();
    
    // Runtime assertion: Fail fast if configuration is wrong
    assertValidMicrosoftOAuthConfig(clientId, authority);

    // MSAL configuration for server-side token exchange
    // IMPORTANT: We use "common" authority here to match the login endpoint
    // This ensures we can exchange codes from any tenant (personal or work/school)
    // The actual tenant ID is extracted from the ID token and stored for future token refresh
    // 
    // NOTE: Token refresh uses tenant-specific authority (see microsoftGraphClient.js)
    // But initial OAuth flow (login + callback) MUST use "common"
    const msalConfig = {
      auth: {
        clientId: clientId, // Validated: Must be AZURE_CLIENT_ID, never AZURE_TENANT_ID
        authority: authority, // Validated: Must be "common" for multi-tenant support
        clientSecret: process.env.AZURE_CLIENT_SECRET,
      },
    };

    const cca = new ConfidentialClientApplication(msalConfig);

    // STEP 3: Exchange authorization code for access_token + refresh_token
    // This is where we actually get tokens - NOT in the login endpoint
    // The code is a one-time use token that Microsoft gives us
    // We exchange it server-side (with client_secret) for real tokens
    // 
    // SERVER-SIDE ONLY: This exchange requires client_secret which must never be exposed to client
    // The redirectUri must match exactly what was used in the login endpoint
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Send', 'Mail.Read', 'Contacts.Read', 'Contacts.ReadWrite', 'Calendars.Read'],
      redirectUri,
    });

    if (!tokenResponse) {
      throw new Error('Failed to acquire tokens');
    }

    // Extract tenant ID from ID token
    // The ID token contains 'tid' (tenant ID) which identifies the user's organization
    let microsoftTenantId = null;
    let microsoftEmail = null;
    let microsoftDisplayName = null;
    
    try {
      // Decode ID token to extract tenant ID and user info
      if (tokenResponse.idToken) {
        // ID token is a JWT: header.payload.signature
        const idTokenParts = tokenResponse.idToken.split('.');
        if (idTokenParts.length === 3) {
          // Decode the payload (base64url)
          const payload = JSON.parse(
            Buffer.from(idTokenParts[1], 'base64url').toString('utf-8')
          );
          
          // Extract tenant ID (tid) from ID token
          microsoftTenantId = payload.tid || null;
          
          // Extract user info from ID token
          microsoftEmail = payload.email || payload.upn || payload.preferred_username || null;
          microsoftDisplayName = payload.name || payload.given_name || null;
        }
      }
    } catch (err) {
      console.warn('Failed to decode ID token:', err);
    }

    // If we didn't get user info from ID token, fetch from Graph API
    if (!microsoftEmail || !microsoftDisplayName) {
      try {
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });
        
        if (graphResponse.ok) {
          const userData = await graphResponse.json();
          microsoftEmail = microsoftEmail || userData.mail || userData.userPrincipalName;
          microsoftDisplayName = microsoftDisplayName || userData.displayName || userData.givenName || null;
        }
      } catch (err) {
        console.warn('Failed to fetch user data from Graph:', err);
      }
    }

    // If ownerId not in state, try to find owner by Microsoft email
    if (!ownerId && microsoftEmail) {
      try {
        const ownerByEmail = await prisma.owners.findFirst({
          where: {
            OR: [
              { email: microsoftEmail },
              { microsoftEmail: microsoftEmail },
            ],
          },
        });
        if (ownerByEmail) {
          ownerId = ownerByEmail.id;
          console.log('✅ Found owner by email:', ownerId);
        }
      } catch (err) {
        console.warn('Failed to find owner by email:', err);
      }
    }

    // If still no ownerId, we can't save tokens
    if (!ownerId) {
      console.error('❌ Cannot save tokens: ownerId not found');
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=owner_not_found`
      );
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenResponse.expiresIn || 3600) * 1000);

    // Store or update tokens directly on Owner model
    // Include tenant ID for tenant-specific token refresh
    await prisma.owners.update({
      where: { id: ownerId },
      data: {
        microsoftAccessToken: tokenResponse.accessToken,
        microsoftRefreshToken: tokenResponse.refreshToken || '',
        microsoftExpiresAt: expiresAt,
        microsoftEmail: microsoftEmail,
        microsoftDisplayName: microsoftDisplayName,
        microsoftTenantId: microsoftTenantId, // Store tenant ID for future token refresh
      },
    });

    console.log('✅ Microsoft OAuth tokens stored for owner:', ownerId);

    // Redirect back to contacts ingest page (where user started OAuth flow)
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?success=1`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
}

