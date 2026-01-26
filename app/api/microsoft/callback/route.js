/**
 * OAuth invariant:
 * - client_id identifies the app
 * - state carries internal owner context
 * - ownerId is NEVER sent as a query param
 * - callback must decode state to resolve owner
 */

import { NextResponse } from 'next/server';
import { exchangeMicrosoftAuthCode } from '@/lib/microsoftTokenExchange';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/callback
 * 
 * OAuth callback route - decodes state to get ownerId and saves tokens directly
 * 
 * Flow:
 * 1. Receive authorization code and state from Microsoft
 * 2. Decode state to extract ownerId
 * 3. Exchange code for tokens
 * 4. Save tokens directly to owner record using ownerId from state
 * 5. Redirect to frontend with success
 * 
 * IMPORTANT: This route does NOT:
 * - Require Firebase auth
 * - Call /api/owner/hydrate
 * - Infer owner identity
 * - Use Redis temporary storage
 * 
 * Owner identity comes exclusively from OAuth state.
 */
export async function GET(request) {
  const appUrl = process.env.APP_URL || 
    (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
  
  try {
    // Extract OAuth callback parameters
    const code = request.nextUrl.searchParams.get('code');
    const rawState = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');
    const errorDescription = request.nextUrl.searchParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(error)}`
      );
    }

    // CRITICAL: Authorization code and state are required
    if (!code || !rawState) {
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=invalid_oauth_callback`
      );
    }

    // Decode state to extract ownerId and companyHQId
    let ownerId;
    let companyHQId = null;
    try {
      const stateData = JSON.parse(decodeURIComponent(rawState));
      ownerId = stateData.ownerId;
      companyHQId = stateData.companyHQId || null; // Extract companyHQId from state
      
      // Validate state timestamp (prevent replay attacks)
      if (stateData.ts && Date.now() - stateData.ts > 10 * 60 * 1000) {
        return NextResponse.redirect(
          `${appUrl}/contacts/ingest/microsoft?error=state_expired${companyHQId ? `&companyHQId=${companyHQId}` : ''}`
        );
      }
    } catch (err) {
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=invalid_state${companyHQId ? `&companyHQId=${companyHQId}` : ''}`
      );
    }

    if (!ownerId) {
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=missing_owner_context${companyHQId ? `&companyHQId=${companyHQId}` : ''}`
      );
    }

    // Exchange authorization code for tokens
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    const tokenData = await exchangeMicrosoftAuthCode({
      code,
      redirectUri,
    });

    // Save tokens to MicrosoftAccount model (new model)
    // Upsert: create if doesn't exist, update if it does
    await prisma.microsoftAccount.upsert({
      where: { ownerId },
      create: {
        ownerId,
        microsoftEmail: tokenData.email,
        microsoftDisplayName: tokenData.displayName,
        microsoftTenantId: tokenData.tenantId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        connectedAt: new Date(),
      },
      update: {
        microsoftEmail: tokenData.email,
        microsoftDisplayName: tokenData.displayName,
        microsoftTenantId: tokenData.tenantId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        lastRefreshedAt: new Date(),
      },
    });

    // Redirect to frontend with success, preserving companyHQId
    const redirectUrl = `${appUrl}/contacts/ingest/microsoft?success=1${companyHQId ? `&companyHQId=${companyHQId}` : ''}`;
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    // Try to preserve companyHQId even on error (if we got that far)
    let companyHQId = null;
    try {
      const rawState = request.nextUrl.searchParams.get('state');
      if (rawState) {
        const stateData = JSON.parse(decodeURIComponent(rawState));
        companyHQId = stateData.companyHQId || null;
      }
    } catch {}
    const redirectUrl = `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(err.message || 'oauth_failed')}${companyHQId ? `&companyHQId=${companyHQId}` : ''}`;
    return NextResponse.redirect(redirectUrl);
  }
}
