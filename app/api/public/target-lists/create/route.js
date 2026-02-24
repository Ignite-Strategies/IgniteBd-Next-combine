import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getRedis } from '@/lib/redis';
import crypto from 'crypto';

/**
 * POST /api/public/target-lists/create
 * Create a public target list from selected contacts
 * 
 * Body:
 * {
 *   "contactIds": ["uuid1", "uuid2", ...],
 *   "companyHQId": "uuid"
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "targetListId": "token",
 *   "publicUrl": "/contacts/target-this-week?targetListId=token&companyHQId=uuid"
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { contactIds, companyHQId } = body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'contactIds array is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify company exists
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Verify contacts exist and belong to company
    const contacts = await prisma.contacts.findMany({
      where: {
        id: { in: contactIds },
        companyHQId: companyHQId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        goesBy: true,
        email: true,
        nextSendDate: true,
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid contacts found' },
        { status: 400 },
      );
    }

    // Generate a unique token for the target list
    const targetListId = crypto.randomBytes(16).toString('hex');

    // Store target list in Redis (expires in 30 days)
    const targetListData = {
      targetListId,
      companyHQId,
      contactIds: contacts.map(c => c.id),
      createdAt: new Date().toISOString(),
      contactCount: contacts.length,
    };

    try {
      const redis = getRedis();
      const redisKey = `target-list:${targetListId}`;
      // Store for 30 days (2592000 seconds)
      await redis.setex(redisKey, 2592000, JSON.stringify(targetListData));
    } catch (redisError) {
      console.warn('⚠️ Redis storage failed (non-critical):', redisError);
      // Continue anyway - the token will still work if we can retrieve contacts by ID
    }
    
    // Generate public URL
    const publicUrl = `/contacts/target-this-week?targetListId=${targetListId}&companyHQId=${companyHQId}`;

    return NextResponse.json({
      success: true,
      targetListId,
      publicUrl,
      contactCount: contacts.length,
      message: `Created public target list with ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('❌ Create public target list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create public target list',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
