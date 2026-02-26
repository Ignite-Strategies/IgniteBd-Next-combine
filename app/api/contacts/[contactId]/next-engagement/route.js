import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const VALID_PURPOSES = ['GENERAL_CHECK_IN', 'UNRESPONSIVE', 'PERIODIC_CHECK_IN', 'REFERRAL_NO_CONTACT'];

/**
 * PATCH /api/contacts/[contactId]/next-engagement
 * Update next engagement date and/or purpose (edit from contact detail).
 * Body: { nextEngagementDate?: string (ISO) | null, nextEngagementPurpose?: NextEngagementPurpose | null }
 * Purpose must be one of: GENERAL_CHECK_IN, UNRESPONSIVE, PERIODIC_CHECK_IN, REFERRAL_NO_CONTACT. Pass null to clear.
 */
export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const resolvedParams = await params;
    const contactId = resolvedParams?.contactId;
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { nextEngagementDate, nextEngagementPurpose } = body ?? {};

    const data = {};
    if (nextEngagementDate !== undefined) {
      data.nextEngagementDate = nextEngagementDate == null || nextEngagementDate === '' ? null : new Date(nextEngagementDate);
    }
    if (nextEngagementPurpose !== undefined) {
      if (nextEngagementPurpose != null && nextEngagementPurpose !== '' && !VALID_PURPOSES.includes(nextEngagementPurpose)) {
        return NextResponse.json(
          { success: false, error: `nextEngagementPurpose must be one of: ${VALID_PURPOSES.join(', ')}` },
          { status: 400 },
        );
      }
      data.nextEngagementPurpose = nextEngagementPurpose == null || nextEngagementPurpose === '' ? null : nextEngagementPurpose;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provide nextEngagementDate and/or nextEngagementPurpose' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data,
      select: {
        id: true,
        nextEngagementDate: true,
        nextEngagementPurpose: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        nextEngagementDate: contact.nextEngagementDate?.toISOString() ?? null,
        nextEngagementPurpose: contact.nextEngagementPurpose ?? null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }
    if (error?.code === 'P2022' || error?.message?.includes('nextEngagementDate')) {
      return NextResponse.json(
        { success: false, error: 'Next engagement column not available; run migration.' },
        { status: 501 },
      );
    }
    console.error('❌ PATCH next-engagement error:', error);
    return NextResponse.json(
      { success: false, error: 'Update failed', details: error?.message },
      { status: 500 },
    );
  }
}
