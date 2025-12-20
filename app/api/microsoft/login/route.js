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
export async function GET(request) {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('base64url');
    
    // Get OAuth configuration
    const clientId = getMicrosoftClientId();
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
      state,
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

