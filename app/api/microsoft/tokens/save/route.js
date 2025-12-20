import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

/**
 * POST /api/microsoft/tokens/save
 * 
 * ROUTE 4: Save tokens
 * 
 * This route saves Microsoft tokens to the Owner record.
 * It requires Firebase authentication to identify the owner.
 * 
 * Flow:
 * 1. Verify Firebase auth (get ownerId)
 * 2. Retrieve tokens from Redis using session ID
 * 3. Save tokens to Owner record
 * 4. Return success
 */
export async function POST(request) {
  try {
    // STEP 1: Verify Firebase auth
    // Firebase is the ONLY identity system - ownerId comes from Firebase UID
    const firebaseUser = await verifyFirebaseToken(request);

    // STEP 2: Resolve ownerId from Firebase UID
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const ownerId = owner.id;

    // STEP 3: Get session ID from request body
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }

    // STEP 4: Retrieve tokens from Redis
    const redisClient = getRedis();
    const redisKey = `microsoft_oauth_session:${sessionId}`;
    const cachedTokens = await redisClient.get(redisKey);

    if (!cachedTokens) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid' },
        { status: 404 }
      );
    }

    const tokenData = typeof cachedTokens === 'string' 
      ? JSON.parse(cachedTokens) 
      : cachedTokens;

    // STEP 5: Save tokens to Owner record
    await prisma.owners.update({
      where: { id: ownerId },
      data: {
        microsoftAccessToken: tokenData.accessToken,
        microsoftRefreshToken: tokenData.refreshToken,
        microsoftExpiresAt: tokenData.expiresAt,
        microsoftEmail: tokenData.email,
        microsoftDisplayName: tokenData.displayName,
        microsoftTenantId: tokenData.tenantId,
      },
    });

    // Delete session from Redis (one-time use)
    await redisClient.del(redisKey);

    console.log('✅ Microsoft OAuth tokens saved for owner:', ownerId);

    return NextResponse.json({
      success: true,
      message: 'Microsoft tokens saved successfully',
    });
  } catch (err) {
    console.error('Save tokens error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to save tokens',
      },
      { status: 500 }
    );
  }
}
