import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { checkSenderVerification } from '@/lib/sendgridSendersApi';

/**
 * POST /api/outreach/verified-senders/validate
 * 
 * Validate that an email address is verified in SendGrid
 * Actually checks SendGrid's API to verify sender status
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

    console.log(`🔍 Validating sender email: ${email}`);
    
    // Actually check SendGrid API for verification status
    const verificationResult = await checkSenderVerification(email);
    
    console.log(`📋 Verification result:`, JSON.stringify(verificationResult, null, 2));
    
    if (!verificationResult.verified) {
      return NextResponse.json({
        success: false,
        verified: false,
        email,
        sender: verificationResult.sender,
        details: verificationResult.details,
        error: verificationResult.details.message || 'Sender is not verified in SendGrid',
        message: verificationResult.details.found
          ? 'Sender exists in SendGrid but is not verified. Please complete verification in SendGrid dashboard (Settings > Sender Authentication).'
          : 'Sender not found in SendGrid. Please add and verify this sender in SendGrid dashboard (Settings > Sender Authentication).',
      }, { status: 400 });
    }
    
    // Sender is verified
    return NextResponse.json({
      success: true,
      verified: true,
      email,
      sender: verificationResult.sender,
      details: verificationResult.details,
      message: 'Sender is verified and ready to use',
    });
  } catch (error) {
    console.error('❌ Validate verified sender error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to validate verified sender';
    let statusCode = 500;
    
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
      statusCode = 401;
    } else if (errorMessage.includes('forbidden') || errorMessage.includes('access')) {
      statusCode = 403;
      errorMessage = 
        'SendGrid API key permissions issue. ' +
        'Your API key needs "Sender Management" or "Full Access" permissions. ' +
        'Please update your API key in SendGrid Settings → API Keys. ' +
        'Original error: ' + errorMessage;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode }
    );
  }
}




