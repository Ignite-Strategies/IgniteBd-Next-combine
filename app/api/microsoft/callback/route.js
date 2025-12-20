import { NextResponse } from 'next/server';
import { exchangeMicrosoftAuthCode } from '@/lib/microsoftTokenExchange';
import { getRedis } from '@/lib/redis';
import crypto from 'crypto';

/**
 * GET /api/microsoft/callback
 * 
 * ROUTE 3: Accept Microsoft tokens
 * 
 * This route receives the OAuth callback from Microsoft with an authorization code.
 * It exchanges the code for tokens and stores them temporarily in Redis.
 * 
 * IMPORTANT: This route does NOT require Firebase auth.
 * Microsoft redirects here, so there's no Firebase token available.
 * 
 * Flow:
 * 1. Receive authorization code from Microsoft
 * 2. Exchange code for tokens (pure service)
 * 3. Store tokens temporarily in Redis with a session ID
 * 4. Redirect to frontend with session ID
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

    // Exchange authorization code for tokens (pure service)
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://app.ignitegrowth.biz/api/microsoft/callback';
    const tokenData = await exchangeMicrosoftAuthCode({
      code,
      redirectUri,
    });

    // Generate a temporary session ID to store tokens
    // This allows the frontend to retrieve tokens after Firebase auth is verified
    const sessionId = crypto.randomBytes(32).toString('hex');
    const redisKey = `microsoft_oauth_session:${sessionId}`;
    
    // Store tokens in Redis with 5 minute TTL (enough time for user to return)
    const redisClient = getRedis();
    await redisClient.setex(
      redisKey,
      5 * 60, // 5 minutes
      JSON.stringify(tokenData)
    );

    console.log('✅ Microsoft tokens exchanged and stored temporarily:', sessionId);

    // Redirect to frontend with session ID
    // Frontend will call /api/microsoft/tokens/save with this session ID
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?oauth_session=${sessionId}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      `${appUrl}/contacts/ingest/microsoft?error=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
}
