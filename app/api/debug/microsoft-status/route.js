import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug/microsoft-status
 * Debug endpoint to check Microsoft connection status for current user
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
        microsoftEmail: true,
        microsoftDisplayName: true,
        microsoftTenantId: true,
      },
    });

    if (!owner) {
      return NextResponse.json({
        success: false,
        error: 'Owner not found',
      }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = owner.microsoftExpiresAt ? new Date(owner.microsoftExpiresAt) : null;

    const hasAccessToken = !!owner.microsoftAccessToken;
    const hasRefreshToken = !!owner.microsoftRefreshToken;
    const hasExpiresAt = !!expiresAt;
    const isNotExpired = expiresAt ? expiresAt > now : false;

    const microsoftConnected = !!(
      owner.microsoftAccessToken &&
      owner.microsoftRefreshToken &&
      expiresAt &&
      expiresAt > now
    );

    return NextResponse.json({
      success: true,
      owner: {
        id: owner.id,
        email: owner.email,
        name: `${owner.firstName} ${owner.lastName}`,
      },
      microsoft: {
        connected: microsoftConnected,
        email: owner.microsoftEmail,
        displayName: owner.microsoftDisplayName,
        tenantId: owner.microsoftTenantId,
        hasAccessToken,
        hasRefreshToken,
        hasExpiresAt,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        isNotExpired,
        currentTime: now.toISOString(),
        // Don't return actual tokens
      },
      debug: {
        check1_accessToken: hasAccessToken ? '✅' : '❌',
        check2_refreshToken: hasRefreshToken ? '✅' : '❌',
        check3_expiresAt: hasExpiresAt ? '✅' : '❌',
        check4_notExpired: isNotExpired ? '✅' : '❌',
        finalStatus: microsoftConnected ? '✅ CONNECTED' : '❌ NOT CONNECTED',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}





