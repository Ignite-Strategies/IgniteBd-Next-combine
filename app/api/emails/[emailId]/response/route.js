import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { ensureContactPipeline } from '@/lib/services/pipelineService';

/**
 * PUT /api/emails/[emailId]/response
 * Record a response from the contact
 *
 * Body: {
 *   contactResponse: string (the reply text)
 *   respondedAt?: string (ISO date, defaults to now)
 *   responseSubject?: string
 *   contactAppreciative?: boolean — "great / let me look into this" → sets 7d next engagement from this response
 *   responseDisposition?: 'positive' | 'not_decision_maker' | 'forwarding' | 'not_interested'
 *     - positive (default): move prospect engaged-awaiting-response → interest
 *     - not_decision_maker | forwarding: move to unassigned, optionally append note
 *     - not_interested: set doNotContactAgain on contact
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
    const { emailId } = resolvedParams || {};
    
    if (!emailId) {
      return NextResponse.json(
        { success: false, error: 'emailId is required' },
        { status: 400 },
      );
    }

    const activity = await prisma.email_activities.findUnique({
      where: { id: emailId },
    });

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { contactResponse, respondedAt, responseSubject, responseDisposition, contactAppreciative } = body ?? {};

    if (!contactResponse) {
      return NextResponse.json(
        { success: false, error: 'contactResponse is required' },
        { status: 400 },
      );
    }

    const responseDate = respondedAt ? new Date(respondedAt) : new Date();
    if (isNaN(responseDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid respondedAt date format' },
        { status: 400 },
      );
    }

    const updated = await prisma.email_activities.update({
      where: { id: emailId },
      data: {
        contactResponse,
        respondedAt: responseDate,
        responseSubject: responseSubject || null,
        hasResponded: true,
        contactAppreciative: contactAppreciative === true ? true : contactAppreciative === false ? false : undefined,
      },
      include: {
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log('✅ Response recorded for email:', emailId);

    const contactId = updated.contact_id;
    if (contactId) {
      // Snap lastRespondedAt; if contactAppreciative, set next engagement 7d from this response
      const contactUpdate = { lastRespondedAt: responseDate };
      if (contactAppreciative === true) {
        const nextEng = new Date(responseDate);
        nextEng.setDate(nextEng.getDate() + 7);
        contactUpdate.nextEngagementDate = nextEng;
        contactUpdate.nextEngagementPurpose = 'periodic_check_in';
      }
      try {
        await prisma.contacts.update({
          where: { id: contactId },
          data: contactUpdate,
        });
      } catch (e) {
        console.warn('⚠️ Could not update contact (lastRespondedAt/nextEngagement):', e?.message);
      }

      const disposition = responseDisposition || 'positive';
      try {
        if (disposition === 'not_decision_maker' || disposition === 'forwarding') {
          await ensureContactPipeline(contactId, { pipeline: 'connector', stage: 'forwarded' });
          const noteSuffix = disposition === 'forwarding'
            ? '\n\n[Response] Said they’ll forward to someone who may care.'
            : '\n\n[Response] Not the decision maker.';
          const contact = await prisma.contacts.findUnique({ where: { id: contactId }, select: { notes: true } });
          const newNotes = (contact?.notes || '').trim() + noteSuffix;
          await prisma.contacts.update({
            where: { id: contactId },
            data: { notes: newNotes.trim() || null },
          });
          console.log('✅ Contact → connector/forwarded (', disposition, ')');
        } else if (disposition === 'not_interested') {
          await prisma.contacts.update({
            where: { id: contactId },
            data: { doNotContactAgain: true },
          });
          console.log('✅ Contact marked doNotContactAgain (not_interested)');
        } else {
          // positive (default): move prospect engaged-awaiting-response → interest
          const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
          if (pipe?.pipeline === 'prospect' && pipe?.stage === 'engaged-awaiting-response') {
            await prisma.pipelines.update({
              where: { contactId },
              data: { stage: 'interest', updatedAt: new Date() },
            });
            console.log('✅ Deal pipeline stage → interest for contact:', contactId);
          }
        }
      } catch (pipeErr) {
        console.warn('⚠️ Could not update pipeline/contact:', pipeErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      email: {
        id: updated.id,
        hasResponded: updated.hasResponded,
        contactResponse: updated.contactResponse,
        respondedAt: updated.respondedAt.toISOString(),
        responseSubject: updated.responseSubject,
        contact: updated.contacts,
      },
    });
  } catch (error) {
    console.error('❌ Record response error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record response',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
