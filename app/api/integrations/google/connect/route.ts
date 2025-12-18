import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generateGoogleAuthUrl } from '@/lib/googleOAuth';

/**
 * GET /api/integrations/google/connect
 * 
 * Initiates Google OAuth flow
 * Verifies Firebase user and redirects to Google consent screen
 */
export async function GET(request: Request) {
  try {
    // Verify Firebase user
    const firebaseUser = await verifyFirebaseToken(request);
    
    if (!firebaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    
    // Generate state for CSRF protection (encode Firebase UID)
    const state = Buffer.from(JSON.stringify({ 
      firebaseUid: firebaseUser.uid,
      timestamp: Date.now(),
    })).toString('base64');
    
    // Generate Google OAuth URL
    const authUrl = generateGoogleAuthUrl(state);
    
    // Redirect to Google consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('❌ Google OAuth connect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate Google OAuth' },
      { status: 500 },
    );
  }
}
