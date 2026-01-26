import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/status
 * 
 * Returns detailed Microsoft connection status (safe data only, no tokens)
 * 
 * Returns comprehensive diagnostic information:
 * {
 *   "connected": true,
 *   "email": "adam@ignitestrategies.co",
 *   "displayName": "Adam Cole",
 *   "tenantId": "39d16fb8-1702-4...",
 *   "tokens": {
 *     "hasAccessToken": true,
 *     "hasRefreshToken": true,
 *     "hasExpiresAt": true,
 *     "expiresAt": "2025-12-20T23:48:32Z",
 *     "isExpired": false,
 *     "expiresInSeconds": 3600,
 *     "canRefresh": true
 *   },
 *   "diagnostics": {
 *     "check1_hasAccessToken": "✅",
 *     "check2_hasRefreshToken": "✅",
 *     "check3_hasExpiresAt": "✅",
 *     "check4_tokenNotExpired": "✅",
 *     "check5_canRefresh": "✅",
 *     "finalStatus": "✅ CONNECTED"
 *   },
 *   "currentTime": "2025-01-25T20:00:00Z"
 * }
 * 
 * Connection logic:
 * - Connected if BOTH accessToken AND refreshToken exist
 * - Even if accessToken is expired, we can refresh it with refreshToken
 * - So expiration only matters for "needs refresh" not "is connected"
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record to find ownerId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
      },
    });

    if (!owner) {
      return NextResponse.json({
        connected: false,
        error: 'Owner not found',
        tokens: {
          hasAccessToken: false,
          hasRefreshToken: false,
          hasExpiresAt: false,
          expiresAt: null,
          isExpired: null,
          expiresInSeconds: null,
          canRefresh: false,
        },
        diagnostics: {
          check1_hasAccessToken: '❌',
          check2_hasRefreshToken: '❌',
          check3_hasExpiresAt: '❌',
          check4_tokenNotExpired: '❌',
          check5_canRefresh: '❌',
          finalStatus: '❌ NOT CONNECTED (Owner not found)',
        },
        currentTime: new Date().toISOString(),
      }, { status: 200 });
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

    // Detailed token analysis
    const now = new Date();
    const expiresAt = microsoftAccount?.expiresAt ? new Date(microsoftAccount.expiresAt) : null;
    
    const hasAccessToken = !!microsoftAccount?.accessToken;
    const hasRefreshToken = !!microsoftAccount?.refreshToken;
    const hasExpiresAt = !!expiresAt;
    const isExpired = expiresAt ? expiresAt <= now : null;
    const expiresInSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) : null;
    const canRefresh = hasRefreshToken; // Can refresh if we have refresh token

    // The RIGHT check: We need BOTH tokens to actually be "connected"
    // - Access token: Can use Microsoft APIs now
    // - Refresh token: Can refresh when access token expires
    // 
    // getValidAccessToken() requires BOTH:
    // - Checks for access token (throws if missing)
    // - refreshAccessToken() requires refresh token (throws if missing)
    //
    // So "connected" = We have both tokens (can use now AND refresh later)
    const isConnected = !!(
      microsoftAccount?.accessToken &&  // Can use now
      microsoftAccount?.refreshToken    // Can refresh when expired
    );

    // Build diagnostics
    const diagnostics = {
      check1_hasAccessToken: hasAccessToken ? '✅' : '❌',
      check2_hasRefreshToken: hasRefreshToken ? '✅' : '❌',
      check3_hasExpiresAt: hasExpiresAt ? '✅' : '❌',
      check4_tokenNotExpired: hasExpiresAt ? (isExpired ? '❌ (expired)' : '✅') : '⚠️ (unknown)',
      check5_canRefresh: canRefresh ? '✅' : '❌',
      finalStatus: isConnected 
        ? (isExpired ? '✅ CONNECTED (token expired, but can refresh)' : '✅ CONNECTED')
        : '❌ NOT CONNECTED',
    };

    // Determine why not connected if applicable
    if (!isConnected) {
      const reasons = [];
      if (!hasAccessToken) reasons.push('missing access token');
      if (!hasRefreshToken) reasons.push('missing refresh token');
      diagnostics.finalStatus = `❌ NOT CONNECTED (${reasons.join(', ')})`;
    }

    // Return comprehensive status
    return NextResponse.json({
      connected: isConnected,
      email: microsoftAccount?.microsoftEmail || null,
      displayName: microsoftAccount?.microsoftDisplayName || null,
      tenantId: microsoftAccount?.microsoftTenantId || null,
      tokens: {
        hasAccessToken,
        hasRefreshToken,
        hasExpiresAt,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        isExpired,
        expiresInSeconds,
        canRefresh,
      },
      diagnostics,
      currentTime: now.toISOString(),
    });
  } catch (error) {
    console.error('Microsoft status error:', error);
    return NextResponse.json({
      connected: false,
      error: error.message || 'Failed to check Microsoft status',
      tokens: {
        hasAccessToken: false,
        hasRefreshToken: false,
        hasExpiresAt: false,
        expiresAt: null,
        isExpired: null,
        expiresInSeconds: null,
        canRefresh: false,
      },
      diagnostics: {
        check1_hasAccessToken: '❌',
        check2_hasRefreshToken: '❌',
        check3_hasExpiresAt: '❌',
        check4_tokenNotExpired: '❌',
        check5_canRefresh: '❌',
        finalStatus: `❌ ERROR: ${error.message}`,
      },
      currentTime: new Date().toISOString(),
    }, { status: error.message?.includes('Unauthorized') ? 401 : 500 });
  }
}

