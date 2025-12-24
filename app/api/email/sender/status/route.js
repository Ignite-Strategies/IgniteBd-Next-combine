import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * GET /api/email/sender/status
 * 
 * Check sender verification status in SendGrid
 * If verified, update Owner model with verified sender info
 * 
 * Query params:
 * - email: (required) Email to check verification status for
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    if (!emailParam) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Get all senders from SendGrid (verified and unverified)
    const sendersResult = await listSenders();
    const allSenders = sendersResult.senders || [];

    // Find sender in SendGrid list by email
    const sender = allSenders.find(
      (s) => (s.from?.email || s.email)?.toLowerCase() === emailParam.toLowerCase()
    );

    if (!sender) {
      return NextResponse.json({
        success: true,
        email: emailParam,
        verified: false,
        message: 'Sender not found in SendGrid. Please send verification email first.',
      });
    }

    // Check verification status
    const isVerified = sender.verified === true;

    // If verified and not yet saved to Owner, update Owner
    if (isVerified && owner.sendgridVerifiedEmail !== emailParam) {
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
      email: emailParam,
      verified: isVerified,
      sender: {
        id: sender.id,
        email: sender.from?.email || sender.email,
        name: sender.from?.name || sender.name,
        verified: isVerified,
      },
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

