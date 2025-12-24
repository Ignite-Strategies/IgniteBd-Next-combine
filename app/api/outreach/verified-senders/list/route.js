import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/outreach/verified-senders/list
 * 
 * Get verified sender for the authenticated owner from database
 * Returns owner's verified sender email/name if they have one configured
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);

    // Get owner's verified sender from database
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

    // If owner has a verified sender, return it in the format expected by frontend
    if (owner.sendgridVerifiedEmail) {
      const sender = {
        id: owner.id, // Use owner id as sender id
        email: owner.sendgridVerifiedEmail,
        name: owner.sendgridVerifiedName || owner.sendgridVerifiedEmail,
        verified: true,
        from: {
          email: owner.sendgridVerifiedEmail,
          name: owner.sendgridVerifiedName || owner.sendgridVerifiedEmail,
        },
      };

      return NextResponse.json({
        success: true,
        senders: [sender], // Return as array to match frontend expectations
      });
    }

    // No verified sender configured
    return NextResponse.json({
      success: true,
      senders: [],
    });
  } catch (error) {
    console.error('List senders error:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list senders',
      },
      { status: 500 }
    );
  }
}

