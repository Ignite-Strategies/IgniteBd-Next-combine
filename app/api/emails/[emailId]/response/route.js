import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { ensureContactPipeline } from '@/lib/services/pipelineService';
import { computeAndPersistNextEngagement } from '@/lib/services/emailCadenceService';

/**
 * PUT /api/emails/[emailId]/response
 * Record a response from the contact: create a CONTACT_RESPONDED row and stamp parent with responseFromEmail.
 *
 * Body: {
 *   contactResponse: string (the reply text → body of the new row)
 *   respondedAt?: string (ISO date, defaults to now)
 *   responseSubject?: string
 *   responseDisposition?: 'positive' | 'not_decision_maker' | 'forwarding' | 'not_interested'
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

    const parent = await prisma.email_activities.findUnique({
      where: { id: emailId },
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

    if (!parent) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { contactResponse, respondedAt, responseSubject, responseDisposition } = body ?? {};

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

    const responseRow = await prisma.email_activities.create({
      data: {
        owner_id: parent.owner_id,
        contact_id: parent.contact_id,
        email: parent.email || null,
        subject: responseSubject || parent.subject,
        body: contactResponse,
        event: 'sent',
        messageId: null,
        emailSequenceOrder: 'CONTACT_RESPONDED',
        source: parent.source || 'OFF_PLATFORM',
        platform: parent.platform || 'manual',
        sentAt: responseDate,
      },
    });

    await prisma.email_activities.update({
      where: { id: emailId },
      data: { responseFromEmail: responseRow.id },
    });

    console.log('✅ Response recorded for email:', emailId, '→ response row:', responseRow.id);

    const contactId = parent.contact_id;
    if (contactId) {
      try {
        await prisma.contact.update({
          where: { id: contactId },
          data: { lastRespondedAt: responseDate },
        });
        await computeAndPersistNextEngagement(contactId);
      } catch (e) {
        if (e?.code === 'P2022') {
          try {
            await prisma.contact.update({
              where: { id: contactId },
              data: { lastRespondedAt: responseDate },
            });
          } catch (e2) {
            console.warn('⚠️ Could not update contact lastRespondedAt:', e2?.message);
          }
        } else {
          console.warn('⚠️ Could not update contact:', e?.message);
        }
      }

      const disposition = responseDisposition || 'positive';
      try {
        if (disposition === 'not_decision_maker' || disposition === 'forwarding') {
          await ensureContactPipeline(contactId, { pipeline: 'connector', stage: 'forwarded' });
          const noteSuffix = disposition === 'forwarding'
            ? '\n\n[Response] Said they’ll forward to someone who may care.'
            : '\n\n[Response] Not the decision maker.';
          const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { notes: true } });
          const newNotes = (contact?.notes || '').trim() + noteSuffix;
          await prisma.contact.update({
            where: { id: contactId },
            data: { notes: newNotes.trim() || null },
          });
          console.log('✅ Contact → connector/forwarded (', disposition, ')');
        } else if (disposition === 'not_interested') {
          await prisma.contact.update({
            where: { id: contactId },
            data: { doNotContactAgain: true },
          });
          console.log('✅ Contact marked doNotContactAgain (not_interested)');
        } else {
          // positive (default): move prospect engaged-awaiting-response → interest
          const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
          if (pipe?.pipeline === 'prospect' && pipe?.stage === 'engaged-awaiting-response') {
            const newStage = 'interest';
            await prisma.pipelines.update({
              where: { contactId },
              data: { stage: newStage, updatedAt: new Date() },
            });
            const { snapPipelineOnContact } = await import('@/lib/services/pipelineService');
            await snapPipelineOnContact(contactId, pipe.pipeline, newStage);
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
        id: parent.id,
        responseFromEmail: responseRow.id,
        responseRow: {
          id: responseRow.id,
          body: responseRow.body,
          subject: responseRow.subject,
          sentAt: responseRow.sentAt?.toISOString() ?? null,
        },
        contact: parent.contacts,
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
