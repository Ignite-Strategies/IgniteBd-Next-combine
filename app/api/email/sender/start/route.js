import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createVerifiedSender } from '@/lib/sendgridSendersApi';

/**
 * POST /api/email/sender/start
 * 
 * Start sender verification process in SendGrid
 * Does NOT update Owner yet - only after verification is confirmed
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name"
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

    // Create verified sender in SendGrid
    // This sends a verification email to the user
    const senderData = {
      from: {
        email,
        name: name || email.split('@')[0],
      },
      reply_to: {
        email, // Use same email for reply-to
      },
    };

    const result = await createVerifiedSender(senderData);
    
    // Do NOT update Owner yet - wait for verification
    // Return pending status
    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Verification email sent. Please check your inbox and click the verification link.',
      senderId: result.sender?.id,
    });
  } catch (error) {
    console.error('Start sender verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start sender verification',
      },
      { status: 500 }
    );
  }
}

