import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/contacts/[contactId]/off-platform-send
 * Track an off-platform email send (manual entry)
 * 
 * Body: {
 *   emailSent: string (ISO date string)
 *   subject?: string
 *   platform?: string (e.g., "gmail", "outlook", "apollo", "manual")
 *   notes?: string
 * }
 */
export async function POST(request, { params }) {
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
    const { emailSent, subject, platform, notes } = body ?? {};

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'emailSent is required' },
        { status: 400 },
      );
    }

    // Parse and validate date
    const emailSentDate = new Date(emailSent);
    if (isNaN(emailSentDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid emailSent date format' },
        { status: 400 },
      );
    }

    // Create off-platform send record
    const offPlatformSend = await prisma.off_platform_email_sends.create({
      data: {
        contactId,
        emailSent: emailSentDate,
        subject: subject || null,
        platform: platform || null,
        notes: notes || null,
      },
    });

    console.log('✅ Off-platform email send tracked:', offPlatformSend.id);

    return NextResponse.json({
      success: true,
      offPlatformSend: {
        id: offPlatformSend.id,
        contactId: offPlatformSend.contactId,
        emailSent: offPlatformSend.emailSent.toISOString(),
        subject: offPlatformSend.subject,
        platform: offPlatformSend.platform,
        notes: offPlatformSend.notes,
        createdAt: offPlatformSend.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Track off-platform send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track off-platform send',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/contacts/[contactId]/off-platform-send
 * Get all off-platform sends for a contact
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

    const offPlatformSends = await prisma.off_platform_email_sends.findMany({
      where: { contactId },
      orderBy: { emailSent: 'desc' },
    });

    return NextResponse.json({
      success: true,
      offPlatformSends: offPlatformSends.map(send => ({
        id: send.id,
        contactId: send.contactId,
        emailSent: send.emailSent.toISOString(),
        subject: send.subject,
        platform: send.platform,
        notes: send.notes,
        createdAt: send.createdAt.toISOString(),
        updatedAt: send.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('❌ Get off-platform sends error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch off-platform sends',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
