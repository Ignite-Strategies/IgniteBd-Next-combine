import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exchangeCodeForTokens } from '@/lib/googleOAuth';
import { google } from 'googleapis';

/**
 * GET /api/integrations/google/callback
 * 
 * OAuth callback handler
 * Exchanges authorization code for tokens and stores refresh token
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Handle OAuth errors
    if (error) {
      console.error('❌ Google OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=access_denied`
      );
    }
    
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=invalid_request`
      );
    }
    
    // Decode state (contains Firebase UID)
    let firebaseUid: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      firebaseUid = decoded.firebaseUid;
    } catch (e) {
      console.error('❌ Invalid state parameter:', e);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=invalid_state`
      );
    }
    
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    if (!tokens.refreshToken) {
      console.error('❌ No refresh token received');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=no_refresh_token`
      );
    }
    
    // Get Google account email
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: tokens.accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    // Find owner by Firebase UID
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUid },
    });
    
    if (!owner) {
      console.error('❌ Owner not found for Firebase UID:', firebaseUid);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=user_not_found`
      );
    }
    
    // Store or update refresh token
    await prisma.googleOAuthToken.upsert({
      where: {
        ownerId_provider: {
          ownerId: owner.id,
          provider: 'google',
        },
      },
      create: {
        ownerId: owner.id,
        provider: 'google',
        refreshToken: tokens.refreshToken,
        scopes: tokens.scope || '',
        email: userInfo.data.email || null,
      },
      update: {
        refreshToken: tokens.refreshToken,
        scopes: tokens.scope || '',
        email: userInfo.data.email || null,
        updatedAt: new Date(),
      },
    });
    
    console.log('✅ Google OAuth connected for owner:', owner.id);
    
    // Redirect back to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleConnected=true`
    );
  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?googleError=callback_failed`
    );
  }
}
