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
    const firebaseUser = await verifyFirebaseToken(request);

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
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      verifiedEmail: owner.sendgridVerifiedEmail,
      verifiedName: owner.sendgridVerifiedName,
      // Only use verified sender or env defaults - NEVER use owner.email (Gmail sign-in)
      email: owner.sendgridVerifiedEmail || process.env.SENDGRID_FROM_EMAIL || null,
      name: owner.sendgridVerifiedName || process.env.SENDGRID_FROM_NAME || null,
    });
  } catch (error) {
    console.error('Get verified sender error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get verified sender',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
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

