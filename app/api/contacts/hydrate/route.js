import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

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
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
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

    // Get owner from firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true }
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    // Get ALL CompanyHQs user has access to (for cross-CompanyHQ contact access)
    const allMemberships = await prisma.company_memberships.findMany({
      where: { userId: owner.id },
      select: { companyHqId: true }
    });
    const accessibleCompanyHQIds = allMemberships.map(m => m.companyHqId);
    
    console.log(`🔍 Hydrating contacts from ${accessibleCompanyHQIds.length} accessible CompanyHQs:`, accessibleCompanyHQIds);

    // Fetch all contacts with all relations (from ALL accessible CompanyHQs)
    const contacts = await prisma.contact.findMany({
      where: {
        crmId: { in: accessibleCompanyHQIds },
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
