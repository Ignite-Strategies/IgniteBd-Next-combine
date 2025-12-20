import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/status
 * 
 * Get Microsoft OAuth connection status for the current user
 */
export async function GET(request) {
  try {
    // CRITICAL: Firebase auth is the primary identity system
    // ownerId MUST be resolved from Firebase user (UID) via local/session context
    // Microsoft OAuth is an attached integration - it does NOT define identity
    // 
    // Architecture:
    // 1. Axios interceptor attaches Firebase token to request
    // 2. Backend resolves ownerId from Firebase UID (firebaseUser.uid → Owner.id)
    // 3. Query Owner record to check Microsoft integration status
    
    // Verify Firebase authentication
    // This reads the Firebase token from Authorization header (set by Axios interceptor)
    const firebaseUser = await verifyFirebaseToken(request);

    // Resolve ownerId from Firebase UID
    // This is the ONLY way to get ownerId - from Firebase session/local auth
    // DO NOT derive ownerId from:
    // - Microsoft tenantId
    // - clientId
    // - query params
    // - headers other than Firebase auth
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      // Owner record doesn't exist yet - user is authenticated but no owner record
      // This is a valid state (owner might be created on first action)
      return NextResponse.json({
        success: true,
        connected: false,
        microsoftAuth: null,
      });
    }

    // Return Microsoft auth status (without sensitive tokens)
    // Microsoft OAuth is an attached integration on the Owner record
    const microsoftAuth = owner.microsoftAccessToken
      ? {
          email: owner.microsoftEmail,
          displayName: owner.microsoftDisplayName,
          expiresAt: owner.microsoftExpiresAt,
        }
      : null;

    return NextResponse.json({
      success: true,
      connected: !!microsoftAuth,
      microsoftAuth,
    });
  } catch (error) {
    console.error('Microsoft status error:', error);
    
    // If no Firebase token provided, return 401 (not connected)
    // This allows UI to render "Connect Microsoft" button without errors
    // This is expected behavior when user isn't authenticated, not a server error
    if (error.message?.includes('No authorization token') || error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { 
          success: false, 
          connected: false,
          microsoftAuth: null 
        },
        { status: 401 }
      );
    }
    
    // Only return 500 for actual server errors
    return NextResponse.json(
      { 
        success: false, 
        connected: false,
        error: error.message || 'Failed to get Microsoft status' 
      },
      { status: 500 }
    );
  }
}

