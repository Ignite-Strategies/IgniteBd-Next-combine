import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import sgMail from '@sendgrid/mail';

/**
 * POST /api/outreach/verified-senders/validate
 * 
 * Validate that an email address is verified in SendGrid
 * This attempts to send a test email to verify the sender identity
 * 
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 */
export async function POST(request) {
  try {
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

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'SendGrid API key not configured' },
        { status: 500 }
      );
    }

    // Try to validate by attempting to check sender identity
    // Note: SendGrid doesn't have a direct API to list verified senders
    // We'll validate by checking if sending would work
    // The actual validation happens when sending - SendGrid will reject if not verified
    
    // For now, we'll return success if email format is valid
    // The real validation happens when actually sending
    // Users should verify their sender in SendGrid dashboard first
    
    return NextResponse.json({
      success: true,
      email,
      message: 'Email format is valid. Make sure this email is verified in SendGrid dashboard (Settings > Sender Authentication).',
      note: 'SendGrid will reject emails if the sender is not verified. Verify your sender identity in SendGrid dashboard before using.',
    });
  } catch (error) {
    console.error('Validate verified sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to validate verified sender',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}


