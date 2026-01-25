import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildMicrosoftAuthorizeUrl } from '@/lib/microsoftAuthUrl';
import { getMicrosoftClientId } from '@/lib/microsoftOAuthGuardrails';

/**
 * GET /api/microsoft/login
 * 
 * NAVIGATION HANDOFF ONLY
 * 
 * This route exists ONLY to hand the browser to Microsoft.
 * It does NOT:
 * - Use Axios
 * - Use fetch
 * - Use Firebase auth
 * - Resolve ownerId
 * - Check Microsoft status
 * - Attach headers
 * - Return JSON
 * - Perform token logic
 * 
 * Its ONLY job is to get the browser out of the app.
 */
/**
 * OAuth invariant:
 * - client_id identifies the app
 * - state carries internal owner context
 * - ownerId is NEVER sent as a query param
 * - callback must decode state to resolve owner
 */
export async function GET(request) {
  try {
    // Get ownerId from query params (required - passed from frontend)
    const ownerId = request.nextUrl.searchParams.get('ownerId');
    // Get companyHQId from query params (optional - preserve context)
    const companyHQId = request.nextUrl.searchParams.get('companyHQId');
    
    if (!ownerId) {
      const appUrl = process.env.APP_URL || 
        (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
      return NextResponse.redirect(
        `${appUrl}/contacts/ingest/microsoft?error=ownerId_required${companyHQId ? `&companyHQId=${companyHQId}` : ''}`
      );
    }
    
    // Get OAuth configuration
    const clientId = getMicrosoftClientId();
    
    // Generate state payload with ownerId, companyHQId (if provided), nonce, and timestamp
    // OAuth state carries owner context - NEVER send ownerId as query param
    // But we CAN include companyHQId in state to preserve it through OAuth flow
    const stateData = {
      ownerId,
      companyHQId: companyHQId || null, // Preserve companyHQId through OAuth flow
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    };
    const encodedState = encodeURIComponent(JSON.stringify(stateData));
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
    ];

    // Generate Microsoft OAuth URL (pure function)
    const authUrl = buildMicrosoftAuthorizeUrl({
      clientId,
      redirectUri,
      scopes,
      state: encodedState,
    });

    // IMMEDIATE redirect - browser leaves app, goes to Microsoft
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth login error:', error);
    const appUrl = process.env.APP_URL || 
      (request.nextUrl.origin || 'https://app.ignitegrowth.biz');
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(error.message || 'Failed to initiate OAuth flow')}`
    );
  }
}

