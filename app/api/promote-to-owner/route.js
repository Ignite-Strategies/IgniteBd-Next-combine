import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { promoteToOwner } from '@/lib/services/promotion';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/promote-to-owner
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  return handleCorsPreflight(request);
}

/**
 * POST /api/promote-to-owner
 * Promote the authenticated contact to owner of their own CompanyHQ
 * Called from client portal when contact clicks "I'm Ready For My Stack"
 */
export async function POST(request) {
  try {
    // Verify Firebase token (contact must be authenticated)
    const decodedToken = await verifyFirebaseToken(request);
    const firebaseUid = decodedToken.uid;

    // Get contact by Firebase UID
    const contact = await prisma.contact.findUnique({
      where: { firebaseUid },
    });

    if (!contact) {
      return corsResponse(
        { success: false, error: 'Contact not found' },
        404,
        request,
      );
    }

    if (contact.role === 'owner') {
      return corsResponse(
        { success: false, error: 'Contact is already an owner' },
        400,
        request,
      );
    }

    if (!contact.firebaseUid) {
      return corsResponse(
        { success: false, error: 'Contact must be activated to become an owner' },
        400,
        request,
      );
    }

    // Promote to owner
    const newHq = await promoteToOwner(contact.id);

    return corsResponse(
      {
        success: true,
        message: 'Successfully promoted to owner',
        companyHQ: {
          id: newHq.id,
          companyName: newHq.companyName,
        },
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ Promote to owner error:', error);
    return corsResponse(
      {
        success: false,
        error: error.message || 'Failed to promote to owner',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      500,
      request,
    );
  }
}

