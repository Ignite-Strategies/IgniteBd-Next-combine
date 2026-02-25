import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/contacts/[contactId]/email-history
 * Get combined email history (platform + off-platform sends)
 * Returns sorted timeline of all email sends
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

    // Get platform sends (email_activities)
    const platformSends = await prisma.email_activities.findMany({
      where: {
        contact_id: contactId,
        event: 'sent', // Only actual sends
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        subject: true,
        email: true,
        event: true,
        campaign_id: true,
      },
    });

    // Get off-platform sends (including drafts — emailSent is now nullable)
    const offPlatformSends = await prisma.off_platform_email_sends.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
    });

    const drafts = offPlatformSends.filter(s => !s.emailSent);
    const sent = offPlatformSends.filter(s => !!s.emailSent);

    // Combine and sort — drafts float to the top, sent sorted by date
    const activities = [
      // Drafts first (sorted by createdAt desc)
      ...drafts.map(send => ({
        id: send.id,
        type: 'draft',
        isDraft: true,
        date: send.createdAt.toISOString(),
        subject: send.subject,
        email: null,
        event: null,
        campaignId: null,
        platform: send.platform,
        notes: send.notes,
      })),
      // Platform sends
      ...platformSends.map(send => ({
        id: send.id,
        type: 'platform',
        isDraft: false,
        date: send.createdAt.toISOString(),
        subject: send.subject,
        email: send.email,
        event: send.event,
        campaignId: send.campaign_id,
        platform: null,
        notes: null,
      })),
      // Off-platform sent (has a date)
      ...sent.map(send => ({
        id: send.id,
        type: 'off-platform',
        isDraft: false,
        date: send.emailSent.toISOString(),
        subject: send.subject,
        email: null,
        event: null,
        campaignId: null,
        platform: send.platform,
        notes: send.notes,
      })),
    ].sort((a, b) => {
      // Drafts always first
      if (a.isDraft && !b.isDraft) return -1;
      if (!a.isDraft && b.isDraft) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    return NextResponse.json({
      success: true,
      activities,
      totalCount: activities.length,
      platformCount: platformSends.length,
      offPlatformCount: sent.length,
      draftCount: drafts.length,
    });
  } catch (error) {
    console.error('❌ Get email history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch email history',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
