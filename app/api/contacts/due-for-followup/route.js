import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';

/**
 * GET /api/contacts/due-for-followup
 * Contacts with nextEngagementDate set. Optional filter: dueBy (ISO date) to only return due on or before that date.
 * Query: companyHQId (required), dueBy (optional), limit (default 500)
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const dueBy = searchParams.get('dueBy'); // optional: only contacts with nextEngagementDate <= dueBy
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 500);

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    let contacts = await getContactsWithNextEngagement(companyHQId, { limit });
    if (dueBy) {
      const cutoff = new Date(dueBy);
      contacts = contacts.filter((c) => c.nextEngagementDate && new Date(c.nextEngagementDate) <= cutoff);
    }

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
      companyHQId,
    });
  } catch (error) {
    console.error('❌ Get contacts due for follow-up error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contacts due for follow-up',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
