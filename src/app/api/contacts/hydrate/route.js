import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/contacts/hydrate
 * 
 * Force refresh all contacts from database and return fresh data
 * This is a backup route to ensure contacts are fully hydrated
 * 
 * Body:
 * {
 *   "companyHQId": "xxxx" // Required - company HQ ID
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "contacts": [...], // Full array of contacts with all relations
 *   "count": 123
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
    const { companyHQId } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Fetch all contacts with all relations
    const contacts = await prisma.contact.findMany({
      where: {
        crmId: companyHQId,
      },
      include: {
        companies: true, // Company relation
        pipelines: true, // Pipeline relation
        contact_lists: true, // Contact lists relation
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ Hydrated ${contacts.length} contacts for companyHQId: ${companyHQId}`);

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
    });
  } catch (error) {
    console.error('❌ Hydrate contacts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate contacts',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
