import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { listSenders } from '@/lib/sendgridSendersApi';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/owner/sender/verify-and-assign
 * 
 * User-facing: Verify sender in SendGrid and auto-assign if verified
 * Dual path: verify success it assigns - no separate lookup needed
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Step 1: Check SendGrid for verified sender
    const sendersResult = await listSenders();
    const allSenders = sendersResult.senders || [];
    
    // Find sender by email
    const sender = allSenders.find(
      (s) => (s.from?.email || s.email)?.toLowerCase() === email.toLowerCase()
    );

    if (!sender) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found in SendGrid. Please verify this email in SendGrid dashboard first.',
        verified: false,
        assigned: false,
      });
    }

    // Check verification status
    const isVerified = sender.verified === true;

    if (!isVerified) {
      return NextResponse.json({
        success: false,
        error: 'Sender found but not verified in SendGrid. Please complete verification in SendGrid dashboard first.',
        verified: false,
        assigned: false,
        sender: {
          id: sender.id,
          email: sender.from?.email || sender.email,
          name: sender.from?.name || sender.name,
          verified: false,
        },
      });
    }

    // Step 2: Auto-assign to authenticated owner (verify success it assigns)
    // Get or find Owner record
    let owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!owner) {
      // Create owner if it doesn't exist
      owner = await prisma.owners.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: firebaseUser.email || null,
          name: firebaseUser.name || null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    // Update owner with verified sender info
    const updated = await prisma.owners.update({
      where: { id: owner.id },
      data: {
        sendgridVerifiedEmail: sender.from?.email || sender.email,
        sendgridVerifiedName: name || sender.from?.name || sender.name || null,
      },
      select: {
        id: true,
        email: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    console.log(`✅ User verified and assigned sender to their own account (${owner.id}):`, {
      email: updated.sendgridVerifiedEmail,
      name: updated.sendgridVerifiedName,
    });

    return NextResponse.json({
      success: true,
      verified: true,
      assigned: true,
      sender: {
        id: sender.id,
        email: sender.from?.email || sender.email,
        name: sender.from?.name || sender.name,
        verified: true,
      },
      owner: updated,
      message: 'Sender verified and assigned successfully',
    });
  } catch (error) {
    console.error('Verify and assign sender error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify and assign sender',
        verified: false,
        assigned: false,
      },
      { status: 500 }
    );
  }
}

