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
          nextEngagementDate: updatedContact.nextEngagementDate?.toISOString?.() ?? null,
        },
      });
    }

    // Parse and validate date
    const remindDate = new Date(remindMeOn);
    if (isNaN(remindDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid remindMeOn date format' },
        { status: 400 },
      );
    }

    // Update contact: remindMeOn (legacy) and nextEngagementDate as single source of truth
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        remindMeOn: remindDate,
        nextEngagementDate: remindDate,
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

    console.log('✅ Reminder set for contact:', contactId, 'on', remindDate.toISOString());

    return NextResponse.json({
      success: true,
      message: 'Reminder set successfully',
      contact: {
        ...updatedContact,
        remindMeOn: updatedContact.remindMeOn ? updatedContact.remindMeOn.toISOString() : null,
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
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Calculate if reminder is due
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const remindDate = contact.remindMeOn ? new Date(contact.remindMeOn) : null;
    const isDue = remindDate && remindDate <= today;
    const daysUntilReminder = remindDate 
      ? Math.ceil((remindDate - today) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      success: true,
      remindMeOn: contact.remindMeOn ? contact.remindMeOn.toISOString() : null,
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
