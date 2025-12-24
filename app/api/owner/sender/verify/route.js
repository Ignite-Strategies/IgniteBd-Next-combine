import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createVerifiedSender } from '@/lib/sendgridSendersApi';

/**
 * POST /api/owner/sender/verify
 * 
 * Simple route: Send verification email via SendGrid
 * Just sends email and returns result - no complex checking
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
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

    // Prepare sender data for SendGrid
    const senderData = {
      from: {
        email,
        name: name || email.split('@')[0],
      },
      reply_to: {
        email, // Use same email for reply-to
      },
    };

    // Send verification email via SendGrid
    const result = await createVerifiedSender(senderData);
    
    return NextResponse.json({
      success: true,
      message: result.message || 'Verification email sent. Please check your inbox and click the verification link.',
      senderId: result.sender?.id,
    });
  } catch (error) {
    console.error('Verify sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send verification email',
      },
      { status: 500 }
    );
  }
}
