import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/outreach/verified-senders
 * 
 * Get verified sender email for the current owner
 * Returns owner's verified sender email/name or null
 */
export async function GET(request) {
  try {
    console.log('📧 GET /api/outreach/verified-senders - Request received');
    
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
      console.log('✅ Firebase token verified:', firebaseUser.uid);
    } catch (authError) {
      console.error('❌ Firebase authentication failed:', {
        message: authError.message,
        name: authError.name,
        code: authError.code,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Please sign in again.',
          details: authError.message,
        },
        { status: 401 }
      );
    }

    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!owner) {
      console.log('❌ Owner not found for firebaseId:', firebaseUser.uid);
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    console.log('✅ Owner found:', {
      id: owner.id,
      hasVerifiedEmail: !!owner.sendgridVerifiedEmail,
      verifiedEmail: owner.sendgridVerifiedEmail,
    });

    return NextResponse.json({
      success: true,
      verifiedEmail: owner.sendgridVerifiedEmail,
      verifiedName: owner.sendgridVerifiedName,
      // Only use verified sender or env defaults - NEVER use owner.email (Gmail sign-in)
      email: owner.sendgridVerifiedEmail || process.env.SENDGRID_FROM_EMAIL || null,
      name: owner.sendgridVerifiedName || process.env.SENDGRID_FROM_NAME || null,
    });
  } catch (error) {
    console.error('❌ Get verified sender error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    
    // Don't double-handle auth errors (already handled above)
    if (error.message?.includes('No authorization token') || 
        error.message?.includes('Authentication failed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Please sign in again.',
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get verified sender',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/outreach/verified-senders
 * 
 * Set verified sender email for the current owner
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function PUT(request) {
  try {
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
    } catch (authError) {
      console.error('❌ Firebase authentication failed:', {
        message: authError.message,
        name: authError.name,
        code: authError.code,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Please sign in again.',
          details: authError.message,
        },
        { status: 401 }
      );
    }
    
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

    // Actually verify with SendGrid that this sender is verified
    console.log(`🔍 Verifying sender ${email} with SendGrid before setting...`);
    try {
      // Lazy import to avoid module-level issues
      const { checkSenderVerification } = await import('@/lib/sendgridSendersApi');
      const verificationResult = await checkSenderVerification(email);
      
      if (!verificationResult.verified) {
        console.log(`❌ Sender ${email} is not verified in SendGrid`);
        return NextResponse.json(
          {
            success: false,
            error: verificationResult.details.found
              ? 'This sender exists in SendGrid but is not verified. Please complete verification in SendGrid dashboard (Settings > Sender Authentication) before using.'
              : 'This sender is not found or verified in SendGrid. Please add and verify this sender in SendGrid dashboard (Settings > Sender Authentication) before using.',
            details: verificationResult.details,
          },
          { status: 400 }
        );
      }
      
      console.log(`✅ Sender ${email} is verified in SendGrid`);
    } catch (verificationError) {
      console.error('❌ Failed to verify sender with SendGrid:', verificationError);
      // If verification check fails (e.g., API permissions), still allow setting
      // but log a warning - the actual send will fail if not verified
      console.warn('⚠️ Could not verify sender with SendGrid API. Setting sender anyway, but actual sending may fail if not verified.');
    }

    const owner = await prisma.owners.update({
      where: { firebaseId: firebaseUser.uid },
      data: {
        sendgridVerifiedEmail: email,
        sendgridVerifiedName: name || null,
      },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    return NextResponse.json({
      success: true,
      verifiedEmail: owner.sendgridVerifiedEmail,
      verifiedName: owner.sendgridVerifiedName,
    });
  } catch (error) {
    console.error('Set verified sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to set verified sender',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

