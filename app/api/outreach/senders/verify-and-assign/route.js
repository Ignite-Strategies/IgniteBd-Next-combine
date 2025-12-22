import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * POST /api/outreach/senders/verify-and-assign
 * 
 * User-facing: Check if sender is verified in SendGrid, then auto-assign to authenticated owner
 * 
 * IMPORTANT: This does NOT create or verify senders in SendGrid.
 * - User must verify sender in SendGrid dashboard first (manual step)
 * - This endpoint only CHECKS if sender is already verified
 * - If verified, auto-assigns to authenticated owner
 * 
 * Flow:
 * 1. User verifies sender in SendGrid dashboard (receives email, clicks link)
 * 2. User comes here and enters their email
 * 3. We check SendGrid API - is it verified?
 * 4. If yes → auto-assign to ownerId
 * 5. If no → show error "Please verify in SendGrid first"
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function POST(request) {
  try {
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

    // Get authenticated owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true, email: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Step 1: Verify sender in SendGrid
    const sendersResult = await listSenders();
    const allSenders = sendersResult.senders || [];
    
    const sender = allSenders.find(
      (s) => (s.from?.email || s.email)?.toLowerCase() === email.toLowerCase()
    );

    if (!sender) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found in SendGrid. Please add and verify the sender in SendGrid Dashboard → Settings → Sender Authentication first.',
        verified: false,
        instructions: 'Go to SendGrid Dashboard, add your sender email, and click the verification link in the email you receive.',
      });
    }

    // Check verification status
    const isVerified = sender.verified === true;

    if (!isVerified) {
      return NextResponse.json({
        success: false,
        error: 'Sender found but not yet verified. Please check your email and click the verification link from SendGrid.',
        verified: false,
        instructions: 'Check your inbox for the SendGrid verification email and click the link to verify.',
      });
    }

    // Step 2: Auto-assign to authenticated owner
    const senderEmail = sender.from?.email || sender.email;
    const senderName = sender.from?.name || sender.name || name;

    const updated = await prisma.owners.update({
      where: { id: owner.id },
      data: {
        sendgridVerifiedEmail: senderEmail,
        sendgridVerifiedName: senderName || null,
      },
      select: {
        id: true,
        email: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    console.log(`✅ User verified and assigned sender to owner ${owner.id}:`, {
      email: updated.sendgridVerifiedEmail,
      name: updated.sendgridVerifiedName,
    });

    return NextResponse.json({
      success: true,
      verified: true,
      assigned: true,
      sender: {
        email: updated.sendgridVerifiedEmail,
        name: updated.sendgridVerifiedName,
        verified: true,
      },
    });
  } catch (error) {
    console.error('Verify and assign sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify and assign sender',
      },
      { status: 500 }
    );
  }
}

