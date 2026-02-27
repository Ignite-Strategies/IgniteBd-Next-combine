import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/contacts/[contactId]/remind-me
 * Set or update a manual "remind me when" date for a contact
 * 
 * Body: {
 *   remindMeOn: string (ISO date string) - when to remind, or null to clear reminder
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

    // Verify contact exists
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
    const { remindMeOn } = body ?? {};

    // If remindMeOn is null/undefined, clear the reminder and next engagement
    if (remindMeOn === null || remindMeOn === undefined) {
      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          remindMeOn: null,
          nextEngagementDate: null,
          nextEngagementPurpose: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          remindMeOn: true,
          nextEngagementDate: true,
          nextEngagementPurpose: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Reminder cleared',
        contact: {
          ...updatedContact,
          remindMeOn: updatedContact.remindMeOn?.toISOString?.() ?? null,
          nextEngagementDate: updatedContact.nextEngagementDate ?? null,
        },
      });
    }

    // Parse and validate date; store nextEngagementDate as date-only "YYYY-MM-DD"
    const remindDate = new Date(remindMeOn);
    if (isNaN(remindDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid remindMeOn date format' },
        { status: 400 },
      );
    }
    const dateOnlyStr = remindDate.toISOString().slice(0, 10);

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        remindMeOn: remindDate,
        nextEngagementDate: dateOnlyStr,
        nextEngagementPurpose: 'GENERAL_CHECK_IN',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        remindMeOn: true,
        nextEngagementDate: true,
        nextEngagementPurpose: true,
      },
    });

    console.log('✅ Reminder set for contact:', contactId, 'on', dateOnlyStr);

    return NextResponse.json({
      success: true,
      message: 'Reminder set successfully',
      contact: {
        ...updatedContact,
        remindMeOn: updatedContact.remindMeOn ? updatedContact.remindMeOn.toISOString() : null,
        nextEngagementDate: updatedContact.nextEngagementDate ?? null,
      },
    });
  } catch (error) {
    console.error('❌ Set reminder error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set reminder',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/contacts/[contactId]/remind-me
 * Get the reminder date for a contact
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
        firstName: true,
        lastName: true,
        remindMeOn: true,
        nextEngagementDate: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dueDateStr = contact.nextEngagementDate ?? (contact.remindMeOn ? contact.remindMeOn.toISOString().slice(0, 10) : null);
    const isDue = dueDateStr && dueDateStr <= todayStr;
    const daysUntilReminder = dueDateStr
      ? Math.ceil((new Date(dueDateStr + 'T12:00:00.000Z') - new Date(todayStr + 'T12:00:00.000Z')) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      success: true,
      remindMeOn: contact.remindMeOn ? contact.remindMeOn.toISOString() : null,
      nextEngagementDate: contact.nextEngagementDate ?? null,
      isDue,
      daysUntilReminder,
    });
  } catch (error) {
    console.error('❌ Get reminder error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get reminder',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
