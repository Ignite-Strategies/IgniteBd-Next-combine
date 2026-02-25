import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/contacts/[contactId]/next-contact
 * Set manual next contact date and toggles (do not contact again, follow next quarter, etc.)
 *
 * Body: {
 *   doNotContactAgain?: boolean   — if true, no follow-up; clears nextContactedAt
 *   nextContactedAt?: string | null  — ISO date when to contact next (e.g. end of quarter)
 *   nextContactNote?: string | null  — e.g. "Follow next quarter", "Do not call - reach out in March"
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
    const {
      doNotContactAgain,
      nextContactedAt,
      nextContactNote,
    } = body ?? {};

    const data = {};

    if (typeof doNotContactAgain === 'boolean') {
      data.doNotContactAgain = doNotContactAgain;
      if (doNotContactAgain) {
        data.nextContactedAt = null;
        data.nextContactNote = null;
      }
    }

    if (doNotContactAgain !== true) {
      if (nextContactedAt !== undefined) {
        if (nextContactedAt === null) {
          data.nextContactedAt = null;
        } else {
          const date = new Date(nextContactedAt);
          if (isNaN(date.getTime())) {
            return NextResponse.json(
              { success: false, error: 'Invalid nextContactedAt date format' },
              { status: 400 },
            );
          }
          data.nextContactedAt = date;
        }
      }
      if (nextContactNote !== undefined) data.nextContactNote = nextContactNote;
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lastContactedAt: true,
        nextContactedAt: true,
        nextContactNote: true,
        doNotContactAgain: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: {
        ...updated,
        lastContactedAt: updated.lastContactedAt?.toISOString() ?? null,
        nextContactedAt: updated.nextContactedAt?.toISOString() ?? null,
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
 * Get current next-contact state (snap + toggles)
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
        lastContactedAt: true,
        nextContactedAt: true,
        nextContactNote: true,
        doNotContactAgain: true,
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
      lastContactedAt: contact.lastContactedAt?.toISOString() ?? null,
      nextContactedAt: contact.nextContactedAt?.toISOString() ?? null,
      nextContactNote: contact.nextContactNote ?? null,
      doNotContactAgain: contact.doNotContactAgain ?? false,
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
