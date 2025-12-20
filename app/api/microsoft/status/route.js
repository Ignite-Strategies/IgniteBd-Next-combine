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
    // Verify Firebase authentication
    // If no token provided, return 401 (not connected) instead of 500 (server error)
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
    } catch (authError) {
      // No Firebase token = user not authenticated
      // Return 401 so UI can render "Connect Microsoft" button
      // This is expected behavior, not a server error
      return NextResponse.json(
        { 
          success: false, 
          connected: false,
          microsoftAuth: null 
        },
        { status: 401 }
      );
    }

    // Get Owner record
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json({
        success: true,
        connected: false,
        microsoftAuth: null,
      });
    }

    // Return Microsoft auth status (without sensitive tokens)
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
    // Only return 500 for actual server errors, not auth issues
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

