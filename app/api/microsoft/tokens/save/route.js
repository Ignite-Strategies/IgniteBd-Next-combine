import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

/**
 * POST /api/microsoft/tokens/save
 * 
 * ROUTE 4: Save tokens (requires Firebase auth, writes to database)
 * 
 * This route saves Microsoft tokens to the Owner record.
 * It requires Firebase authentication to identify the owner.
 * 
 * NOTE:
 * Owner hydration happens once during app boot.
 * Feature routes and OAuth flows MUST NOT hydrate.
 * OAuth returns tokens only. Save routes attach them.
 * 
 * Flow:
 * 1. Verify Firebase auth (get ownerId)
 * 2. Retrieve tokens from Redis using session ID
 * 3. Save tokens to Owner record
 * 4. Return structured success/error responses
 */
export async function POST(request) {
  try {
    // STEP 1: Verify Firebase auth
    // Firebase is the ONLY identity system - ownerId comes from Firebase UID
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
    } catch (err) {
      return NextResponse.json(
        { 
          success: false,
          error: 'NOT_AUTHENTICATED', 
          action: 'LOGIN_REQUIRED',
          message: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // STEP 2: Resolve ownerId from Firebase UID
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { 
          success: false,
          error: 'OWNER_NOT_FOUND', 
          action: 'RELOAD_APP',
          message: 'Owner account not found'
        },
        { status: 404 }
      );
    }

    const ownerId = owner.id;

    // STEP 3: Get session ID from request body
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'MISSING_SESSION_ID', 
          action: 'RECONNECT_MICROSOFT',
          message: 'OAuth session ID required'
        },
        { status: 400 }
      );
    }

    // STEP 4: Retrieve tokens from Redis
    const redisClient = getRedis();
    const redisKey = `microsoft_oauth_session:${sessionId}`;
    const cachedTokens = await redisClient.get(redisKey);

    if (!cachedTokens) {
      return NextResponse.json(
        { 
          success: false,
          error: 'SESSION_EXPIRED', 
          action: 'RECONNECT_MICROSOFT',
          message: 'OAuth session expired. Please reconnect.'
        },
        { status: 404 }
      );
    }

    const tokenData = typeof cachedTokens === 'string' 
      ? JSON.parse(cachedTokens) 
      : cachedTokens;

    // Validate token data
    if (!tokenData.accessToken) {
      return NextResponse.json(
        { 
          success: false,
          error: 'MISSING_MICROSOFT_TOKEN', 
          action: 'RECONNECT_MICROSOFT',
          message: 'Microsoft access token missing'
        },
        { status: 400 }
      );
    }

    // STEP 5: Save tokens to Owner record
    await prisma.owners.update({
      where: { id: ownerId },
      data: {
        microsoftAccessToken: tokenData.accessToken,
        microsoftRefreshToken: tokenData.refreshToken,
        microsoftExpiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        microsoftEmail: tokenData.email,
        microsoftDisplayName: tokenData.displayName,
        microsoftTenantId: tokenData.tenantId,
      },
    });

    // Delete session from Redis (one-time use)
    await redisClient.del(redisKey);

    return NextResponse.json({
      success: true,
      message: 'Microsoft tokens saved successfully',
    });
  } catch (err) {
    // Database or unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'SAVE_FAILED',
        action: 'RETRY',
        message: 'Failed to save tokens. Please try again.',
      },
      { status: 500 }
    );
  }
}






