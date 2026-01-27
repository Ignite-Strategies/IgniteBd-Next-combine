import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug/microsoft-status
 * Debug endpoint to check Microsoft connection status for current user
 * Now uses MicrosoftAccount model instead of owner.microsoft* fields
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
      },
    });

    if (!owner) {
      return NextResponse.json({
        success: false,
        error: 'Owner not found',
      }, { status: 404 });
    }

    // Get MicrosoftAccount record (new model)
    const microsoftAccount = await prisma.microsoftAccount.findUnique({
      where: { ownerId: owner.id },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
        microsoftEmail: true,
        microsoftDisplayName: true,
        microsoftTenantId: true,
      },
    });

    const now = new Date();
    const expiresAt = microsoftAccount?.expiresAt ? new Date(microsoftAccount.expiresAt) : null;

    const hasAccessToken = !!microsoftAccount?.accessToken;
    const hasRefreshToken = !!microsoftAccount?.refreshToken;
    const hasExpiresAt = !!expiresAt;
    const isNotExpired = expiresAt ? expiresAt > now : false;

    const microsoftConnected = !!(
      microsoftAccount?.accessToken &&
      microsoftAccount?.refreshToken
    );

    return NextResponse.json({
      success: true,
      owner: {
        id: owner.id,
        email: owner.email,
        name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim(),
      },
      microsoft: {
        connected: microsoftConnected,
        email: microsoftAccount?.microsoftEmail || null,
        displayName: microsoftAccount?.microsoftDisplayName || null,
        tenantId: microsoftAccount?.microsoftTenantId || null,
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







