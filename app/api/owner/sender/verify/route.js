import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * POST /api/owner/sender/verify
 * 
 * User-facing: Verify sender in SendGrid
 * Checks if sender email exists and is verified in SendGrid
 * 
 * Body:
 * {
 *   "email": "user@example.com"
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    
    const body = await request.json();
    const { email } = body;

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

    // Get all senders from SendGrid
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
      });
    }

    // Check verification status
    const isVerified = sender.verified === true;

    return NextResponse.json({
      success: true,
      verified: isVerified,
      sender: {
        id: sender.id,
        email: sender.from?.email || sender.email,
        name: sender.from?.name || sender.name,
        verified: isVerified,
      },
    });
  } catch (error) {
    console.error('Verify sender error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify sender',
      },
      { status: 500 }
    );
  }
}

