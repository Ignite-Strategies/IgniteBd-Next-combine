import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { computeAndPersistNextEngagement } from '@/lib/services/emailCadenceService';

/**
 * POST /api/outreach/recalculate-next-engagement
 * Recalculate nextEngagementDate for all contacts in a company (or all contacts).
 * Query: companyHQId (optional) — if omitted, recalculates for all contacts with crmId set.
 * Use for "Recalculate" UX button to put numbers on contacts.
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
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || null;

    const where = companyHQId ? { crmId: companyHQId, doNotContactAgain: false } : { crmId: { not: null }, doNotContactAgain: false };
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
    });

    let updated = 0;
    let errors = 0;
    for (const c of contacts) {
      try {
        const result = await computeAndPersistNextEngagement(c.id);
        if (result.updated) updated++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      total: contacts.length,
      companyHQId: companyHQId || 'all',
    });
  } catch (error) {
    console.error('❌ Recalculate next engagement error:', error);
    return NextResponse.json(
      { success: false, error: 'Recalculate failed', details: error?.message },
      { status: 500 },
    );
  }
}
