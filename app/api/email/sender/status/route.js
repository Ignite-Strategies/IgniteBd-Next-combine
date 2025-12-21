import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { listVerifiedSenders } from '@/lib/sendgridSendersApi';

/**
 * GET /api/email/sender/status
 * 
 * Check sender verification status in SendGrid
 * If verified, update Owner model with verified sender info
 * 
 * Query params:
 * - email: (optional) Check specific email, otherwise checks owner's pending sender
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
        email: true, // For reference only, not used
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Get all verified senders from SendGrid
    const sendersResult = await listVerifiedSenders();
    const senders = sendersResult.senders || [];

    // If email param provided, check that specific email
    // Otherwise, check if owner already has a verified email
    const emailToCheck = emailParam || owner.sendgridVerifiedEmail;

    if (!emailToCheck) {
      return NextResponse.json({
        success: true,
        email: null,
        verified: false,
        message: 'No sender email to check',
      });
    }

    // Find sender in SendGrid list
    const sender = senders.find(
      (s) => (s.from?.email || s.email)?.toLowerCase() === emailToCheck.toLowerCase()
    );

    if (!sender) {
      return NextResponse.json({
        success: true,
        email: emailToCheck,
        verified: false,
        message: 'Sender not found in SendGrid',
      });
    }

    // Check verification status
    const isVerified = sender.verified?.status === 'verified' || 
                       sender.verified === true ||
                       sender.verification?.status === 'verified';

    // If verified and not yet saved to Owner, update Owner
    if (isVerified && owner.sendgridVerifiedEmail !== emailToCheck) {
      const senderEmail = sender.from?.email || sender.email;
      const senderName = sender.from?.name || sender.name;

      await prisma.owners.update({
        where: { id: owner.id },
        data: {
          sendgridVerifiedEmail: senderEmail,
          sendgridVerifiedName: senderName || null,
        },
      });

      console.log(`✅ Updated owner ${owner.id} with verified sender: ${senderEmail}`);
    }

    return NextResponse.json({
      success: true,
      email: emailToCheck,
      verified: isVerified,
      sender: sender,
    });
  } catch (error) {
    console.error('Check sender status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check sender status',
      },
      { status: 500 }
    );
  }
}

