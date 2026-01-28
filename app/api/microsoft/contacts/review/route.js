import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { prepareContactsForReview } from '@/lib/contactFromPreviewService';

/**
 * POST /api/microsoft/contacts/review
 * 
 * Prepare selected preview items for review before saving
 * Maps preview items to Contact structure and checks which already exist
 * 
 * Body:
 * {
 *   "previewItems": [{ previewId, email, displayName, ... }, ...],
 *   "companyHQId": "required"
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "contacts": [
 *     {
 *       "previewId": "hash",
 *       "email": "user@example.com",
 *       "firstName": "John",
 *       "lastName": "Smith",
 *       "displayName": "John Smith",
 *       "companyName": "Acme Corp",
 *       "jobTitle": "CEO",
 *       "alreadyExists": false
 *     }
 *   ]
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { previewItems, companyHQId } = body;

    // Validate inputs
    if (!previewItems || !Array.isArray(previewItems) || previewItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'previewItems array is required' },
        { status: 400 }
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Get all companyHQs this owner has access to
    const memberships = await prisma.company_memberships.findMany({
      where: { userId: owner.id },
      select: { companyHqId: true },
    });
    const companyHQIds = memberships.map(m => m.companyHqId);

    if (!companyHQIds.includes(companyHQId)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No access to this CompanyHQ' },
        { status: 403 }
      );
    }

    // Prepare contacts for review - map and check existing
    const contacts = await prepareContactsForReview(previewItems, companyHQIds);

    return NextResponse.json({
      success: true,
      contacts,
      stats: {
        total: contacts.length,
        alreadyExists: contacts.filter(c => c.alreadyExists).length,
        new: contacts.filter(c => !c.alreadyExists).length,
      },
    });
  } catch (error) {
    console.error('❌ Microsoft contacts review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare contacts for review',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
