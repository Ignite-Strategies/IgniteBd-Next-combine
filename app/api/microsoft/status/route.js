import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/status
 * 
 * Returns Microsoft connection status (safe data only, no tokens)
 * 
 * Returns:
 * {
 *   "connected": true,
 *   "email": "adam@ignitestrategies.co",
 *   "expiresAt": "2025-12-20T23:48:32Z"
 * }
 * 
 * Connection is derived from:
 * - owner.microsoftAccessToken exists
 * - owner.microsoftRefreshToken exists
 * - owner.microsoftExpiresAt > now
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record with Microsoft auth fields
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
        microsoftEmail: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { connected: false },
        { status: 200 }
      );
    }

    // Derive connection status
    const now = new Date();
    const expiresAt = owner.microsoftExpiresAt ? new Date(owner.microsoftExpiresAt) : null;
    
    const isConnected = !!(
      owner.microsoftAccessToken &&
      owner.microsoftRefreshToken &&
      expiresAt &&
      expiresAt > now
    );

    // Return safe data only (no tokens)
    return NextResponse.json({
      connected: isConnected,
      email: owner.microsoftEmail || null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error('Microsoft status error:', error);
    return NextResponse.json(
      { connected: false, error: error.message || 'Failed to check Microsoft status' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

