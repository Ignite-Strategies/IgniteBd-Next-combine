import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createVerifiedSender } from '@/lib/sendgridSendersApi';

/**
 * POST /api/outreach/verified-senders/create
 * 
 * Create/initiate verification for a new sender in SendGrid
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name",
 *   "address": "123 Main St" (optional),
 *   "city": "City" (optional),
 *   "state": "State" (optional),
 *   "zip": "12345" (optional),
 *   "country": "US" (optional)
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
    const body = await request.json();
    const { email, name, address, city, state, zip, country } = body;

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
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(zip && { zip }),
      ...(country && { country }),
    };

    const result = await createVerifiedSender(senderData);
    
    return NextResponse.json({
      success: true,
      sender: result.sender,
      message: 'Verification email sent. Please check your inbox to complete verification.',
    });
  } catch (error) {
    console.error('Create verified sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create verified sender',
      },
      { status: 500 }
    );
  }
}





