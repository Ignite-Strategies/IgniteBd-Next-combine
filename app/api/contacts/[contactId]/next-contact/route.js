import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/contacts/[contactId]/next-contact
 * Set manual next contact date and disposition.
 *
 * Body: {
 *   contactDisposition?: ContactDisposition  — sets disposition; OPTED_OUT clears nextEngagementDate
 *   nextEngagementDate?: string | null       — ISO date "YYYY-MM-DD" to contact next
 *   nextContactNote?: string | null          — e.g. "Follow next quarter", "Reach out in March"
 * }
 */
export async function PUT(request, { params }) {
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
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { contactDisposition, nextEngagementDate, nextContactNote } = body ?? {};

    const data = {};

    if (contactDisposition !== undefined) {
      data.contactDisposition = contactDisposition;
      // OPTED_OUT is a hard gate — clear the engagement date
      if (contactDisposition === 'OPTED_OUT') {
        data.nextEngagementDate = null;
        data.nextEngagementPurpose = null;
        data.nextContactNote = null;
      }
    }

    if (contactDisposition !== 'OPTED_OUT') {
      if (nextEngagementDate !== undefined) {
        data.nextEngagementDate = nextEngagementDate ?? null;
      }
      if (nextContactNote !== undefined) {
        data.nextContactNote = nextContactNote ?? null;
      }
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lastEngagementDate: true,
        lastEngagementType: true,
        nextEngagementDate: true,
        nextContactNote: true,
        contactDisposition: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: {
        ...updated,
        lastEngagementDate: updated.lastEngagementDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('❌ Update next-contact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update next contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/contacts/[contactId]/next-contact
 * Get current next-contact state
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
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      lastEngagementDate: contact.lastEngagementDate?.toISOString() ?? null,
      lastEngagementType: contact.lastEngagementType ?? null,
      nextEngagementDate: contact.nextEngagementDate ?? null,
      nextContactNote: contact.nextContactNote ?? null,
      contactDisposition: contact.contactDisposition ?? null,
      optedOut: contact.contactDisposition === 'OPTED_OUT',
    });
  } catch (error) {
    console.error('❌ Get next-contact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get next contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
