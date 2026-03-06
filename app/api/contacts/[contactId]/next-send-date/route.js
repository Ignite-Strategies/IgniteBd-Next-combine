import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { cadenceDaysForDisposition } from '@/lib/services/engagementService';

/**
 * GET /api/contacts/[contactId]/next-send-date
 * Read next engagement date and cadence info directly from the contact record.
 */
export async function GET(request, { params }) {
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
    const { contactId } = resolvedParams || {};

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        lastEngagementDate: true,
        lastEngagementType: true,
        nextEngagementDate: true,
        nextContactNote: true,
        contactDisposition: true,
        prior_relationship: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const todayMs = Date.now();
    const nextSendDate = contact.nextEngagementDate ?? null;
    const daysUntilDue = nextSendDate
      ? Math.round((new Date(nextSendDate + 'T12:00:00Z').getTime() - todayMs) / 86400000)
      : null;

    return NextResponse.json({
      success: true,
      nextSendDate,
      lastSendDate: contact.lastEngagementDate?.toISOString() ?? null,
      daysUntilDue,
      relationship: contact.prior_relationship ?? null,
      cadenceDays: cadenceDaysForDisposition(contact.contactDisposition),
      isDue: daysUntilDue !== null && daysUntilDue <= 0,
      optedOut: contact.contactDisposition === 'OPTED_OUT',
      contactDisposition: contact.contactDisposition ?? null,
      nextContactNote: contact.nextContactNote ?? null,
    });
  } catch (error) {
    console.error('❌ next-send-date error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get next send date', details: error.message },
      { status: 500 },
    );
  }
}
