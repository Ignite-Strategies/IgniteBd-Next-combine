import { NextResponse } from 'next/server';
import { exchangeMicrosoftAuthCode } from '@/lib/microsoftTokenExchange';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/callback
 * 
 * ROUTE 3: Accept Microsoft tokens and save them
 * 
 * This route receives the OAuth callback from Microsoft with an authorization code.
 * It exchanges the code for tokens and saves them directly to the Owner record.
 * 
 * IMPORTANT: This route does NOT require Firebase auth.
 * ownerId comes from the OAuth state parameter (encoded in login route).
 * 
 * Flow:
 * 1. Receive authorization code from Microsoft
 * 2. Decode ownerId from state parameter
 * 3. Exchange code for tokens (pure service)
 * 4. Save tokens directly to Owner record
 * 5. Redirect to frontend with success
 */
export async function GET(request) {
  const appUrl = process.env.APP_URL || 
    (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
  
  try {
    // Extract OAuth callback parameters
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

    // CRITICAL: Authorization code is required
    if (!code) {
      console.error('❌ No authorization code provided in callback');
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=no_authorization_code_provided`
      );
    }

    // Decode ownerId and clientId from state parameter
    let ownerId = null;
    let clientId = null;
    try {
      if (state) {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        ownerId = stateData.ownerId;
        clientId = stateData.clientId;
        
        // Verify state is recent (within 10 minutes)
        if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
          throw new Error('State expired');
        }
      }
    } catch (err) {
      console.error('❌ Failed to decode state parameter:', err);
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=invalid_state`
      );
    }

    // Log state data for debugging
    console.log('📋 OAuth callback state:', { ownerId, clientId });

    // If ownerId not in state, callback can't save tokens
    // This is OK - user can reconnect later with ownerId
    if (!ownerId) {
      console.warn('⚠️ ownerId not found in state parameter - tokens cannot be saved', { clientId });
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=ownerId_not_found`
      );
    }

    // Exchange authorization code for tokens (pure service)
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    const tokenData = await exchangeMicrosoftAuthCode({
      code,
      redirectUri,
    });

    // Save tokens directly to Owner record
    await prisma.owners.update({
      where: { id: ownerId },
      data: {
        microsoftAccessToken: tokenData.accessToken,
        microsoftRefreshToken: tokenData.refreshToken,
        microsoftExpiresAt: tokenData.expiresAt,
        microsoftEmail: tokenData.email,
        microsoftDisplayName: tokenData.displayName,
        microsoftTenantId: tokenData.tenantId,
      },
    });

    console.log('✅ Microsoft OAuth tokens saved for owner:', ownerId);

    // Redirect to frontend with success
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
