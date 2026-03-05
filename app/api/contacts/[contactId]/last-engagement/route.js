import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { stampLastEngagement } from '@/lib/services/emailCadenceService';

const VALID_TYPES = ['OUTBOUND_EMAIL', 'CONTACT_RESPONSE', 'MEETING', 'MANUAL'];

/**
 * PATCH /api/contacts/[contactId]/last-engagement
 * Update last engagement date and/or type (edit from contact detail).
 * Body: { lastEngagementDate?: string "YYYY-MM-DD" | null, lastEngagementType?: EngagementType | null }
 * Type must be one of: OUTBOUND_EMAIL, CONTACT_RESPONSE, MEETING, MANUAL. Pass null to clear.
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
    const { lastEngagementDate, lastEngagementType } = body ?? {};

    if (lastEngagementDate !== undefined && lastEngagementDate != null && lastEngagementDate !== '') {
      const dateOnly = String(lastEngagementDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return NextResponse.json(
          { success: false, error: 'lastEngagementDate must be YYYY-MM-DD' },
          { status: 400 },
        );
      }

      // Use stampLastEngagement service (respects "only move forward" rule)
      const engagementType = lastEngagementType && VALID_TYPES.includes(lastEngagementType) 
        ? lastEngagementType 
        : 'MANUAL';
      
      const result = await stampLastEngagement(contactId, dateOnly + 'T12:00:00.000Z', engagementType);
      
      if (!result.updated) {
        // Date was older than existing, but user explicitly set it — allow override
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            lastEngagementDate: new Date(dateOnly + 'T12:00:00.000Z'),
            lastEngagementType: engagementType,
          },
        });
      }
    } else if (lastEngagementType !== undefined && lastEngagementDate == null) {
      // Only updating type, not date
      if (lastEngagementType != null && lastEngagementType !== '' && !VALID_TYPES.includes(lastEngagementType)) {
        return NextResponse.json(
          { success: false, error: `lastEngagementType must be one of: ${VALID_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastEngagementType: lastEngagementType == null || lastEngagementType === '' ? null : lastEngagementType,
        },
      });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        lastEngagementDate: true,
        lastEngagementType: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        lastEngagementDate: contact.lastEngagementDate ? contact.lastEngagementDate.toISOString() : null,
        lastEngagementType: contact.lastEngagementType ?? null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }
    console.error('❌ PATCH last-engagement error:', error);
    return NextResponse.json(
      { success: false, error: 'Update failed', details: error?.message },
      { status: 500 },
    );
  }
}
