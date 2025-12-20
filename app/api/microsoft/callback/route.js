import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { exchangeMicrosoftAuthCode } from '@/lib/microsoftTokenExchange';

/**
 * GET /api/microsoft/callback
 * 
 * SERVER-SIDE ONLY: Handles Microsoft OAuth callback
 * 
 * Required order:
 * 1. Verify Firebase auth
 * 2. Resolve ownerId from Firebase UID
 * 3. Call exchangeMicrosoftAuthCode (pure service)
 * 4. Persist tokens to Owner
 * 5. Redirect user back to app
 */
export async function GET(request) {
  const appUrl = process.env.APP_URL || 
    (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
  
  try {
    // Extract OAuth callback parameters
    const code = request.nextUrl.searchParams.get('code');
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

    // STEP 1: Verify Firebase auth
    // Firebase is the ONLY identity system - ownerId comes from Firebase UID
    const firebaseUser = await verifyFirebaseToken(request);

    // STEP 2: Resolve ownerId from Firebase UID
    // Microsoft OAuth does NOT define identity - ownerId comes from Firebase
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      console.error('❌ Cannot save tokens: Owner not found for Firebase UID:', firebaseUser.uid);
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=owner_not_found`
      );
    }

    const ownerId = owner.id;

    // STEP 3: Exchange authorization code for tokens (pure service)
    // This is infrastructure - no identity, no database, just token exchange
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    const tokenData = await exchangeMicrosoftAuthCode({
      code,
      redirectUri,
    });

    // STEP 4: Persist tokens to Owner
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

    console.log('✅ Microsoft OAuth tokens stored for owner:', ownerId);

    // STEP 5: Redirect user back to app
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

