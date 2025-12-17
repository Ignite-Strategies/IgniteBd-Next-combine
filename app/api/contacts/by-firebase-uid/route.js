import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/contacts/by-firebase-uid
 * Handle CORS preflight requests
 * CRITICAL: Must return CORS headers for preflight to pass
 */
export async function OPTIONS(request) {
  console.log('🔍 OPTIONS preflight request received for /api/contacts/by-firebase-uid');
  const origin = request.headers.get('origin');
  console.log('📍 Origin:', origin);
  
  const response = handleCorsPreflight(request);
  console.log('✅ OPTIONS response headers:', Object.fromEntries(response.headers.entries()));
  return response;
}

/**
 * GET /api/contacts/by-firebase-uid
 * Get contact by Firebase UID (for client portal)
 * Returns contact info including role
 */
export async function GET(request) {
  try {
    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(request);
    const firebaseUid = decodedToken.uid;

    // Get contact by Firebase UID
    const contact = await prisma.contact.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        ownerId: true,
        crmId: true,
        isActivated: true,
      },
    });

    if (!contact) {
      return corsResponse(
        { success: false, error: 'Contact not found' },
        404,
        request,
      );
    }

    return corsResponse(
      {
        success: true,
        contact,
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ GetContactByFirebaseUid error:', error);
    return corsResponse(
      {
        success: false,
        error: error.message?.includes('Unauthorized') ? 'Unauthorized' : 'Failed to get contact',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      error.message?.includes('Unauthorized') ? 401 : 500,
      request,
    );
  }
}

